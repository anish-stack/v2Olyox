const RideBooking = require("./NewRideModel.model");
const axios = require("axios");
const User = require("../../models/normal_user/User.model");
const RiderModel = require("../../models/Rider.model");

// Utility to generate UUID
const { v4: uuidv4 } = require('uuid');
const { sendNotification } = require("../../utils/sendNotification");




const scheduleRideCancellationCheck = async (redisClient, rideId) => {
    const CANCELLATION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
    setTimeout(async () => {
        try {
            const ride = await RideBooking.findById(rideId).populate('user');
            if (!ride) {
                console.error(`Ride ${rideId} not found for cancellation check`);
                return;
            }
            if (ride.ride_status === 'pending' || ride.ride_status === 'searching') {
                console.info(`No driver assigned for ride ${rideId} within 2 minutes, cancelling`);
                const updatedRide = await updateRideStatus(redisClient, rideId, 'cancelled', {
                    cancellation_reason: 'No driver found within time limit',
                    cancelled_at: new Date(),
                    cancelledBy: 'system'
                });
                // Notify user of cancellation
                if (updatedRide.user && updatedRide.user.fcmToken) {
                    await sendNotification.sendNotification(
                        updatedRide.user.fcmToken,
                        "Ride Cancelled",
                        "No drivers were available for your ride request.",
                        {
                            event: 'RIDE_CANCELLED',
                            rideId: rideId,
                            message: 'No drivers were available for your ride request.',
                            screen: 'RideHistory',
                        }
                    );
                }
                // Remove ride from Redis
                if (redisClient) {
                    await redisClient.del(`ride:${rideId}`);
                    await redisClient.del(`riders:${rideId}`);
                }
            }
        } catch (error) {
            console.error(`Error during cancellation check for ride ${rideId}:`, error.message);
        }
    }, CANCELLATION_TIMEOUT_MS);
};




exports.NewcreateRequest = async (req, res) => {
    try {
        const user = Array.isArray(req.user.user)
            ? req.user.user[0]
            : req.user.user;
        const {
            vehicleType,
            pickupLocation,
            dropLocation,
            currentLocation,
            pick_desc,
            fare,
            drop_desc,
            fcmToken,
            paymentMethod = "cash",
            platform = "android",
            scheduledAt = null,
            pickupAddress = {},
            dropAddress = {},
        } = req.body;

        // Validate required fields
        if (
            !pickupLocation ||
            !dropLocation ||
            !pick_desc ||
            !drop_desc ||
            !currentLocation ||
            !vehicleType
        ) {
            console.warn("Missing required fields in ride request");
            return res.status(400).json({
                error: "All required fields must be provided",
                required: [
                    "vehicleType",
                    "pickupLocation",
                    "dropLocation",
                    "currentLocation",
                    "pick_desc",
                    "drop_desc",
                ],
            });
        }

        const redisClient = getRedisClient(req)
        // Validate fare object if provided
        if (fare && typeof fare !== "object") {
            return res.status(400).json({
                error: "Fare must be an object with pricing details",
            });
        }

        // Validate coordinates
        const validateCoordinates = (coords, name) => {
            if (!coords.longitude || !coords.latitude) {
                throw new Error(`Invalid ${name} coordinates`);
            }
            if (
                coords.longitude < -180 ||
                coords.longitude > 180 ||
                coords.latitude < -90 ||
                coords.latitude > 90
            ) {
                throw new Error(`${name} coordinates out of valid range`);
            }
        };

        validateCoordinates(pickupLocation, "pickup");
        validateCoordinates(dropLocation, "drop");
        validateCoordinates(currentLocation, "current");

        // Validate scheduled time if provided
        if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);
            if (scheduledDate <= new Date()) {
                return res.status(400).json({
                    error: "Scheduled time must be in the future",
                });
            }
        }

        // Find and update user
        const findUser = await User.findById(user);
        if (!findUser) {
            console.error("User not found", { userId: user });
            return res.status(404).json({ error: "User not found" });
        }

        // Update FCM token if provided and different
        if (fcmToken && findUser.fcmToken !== fcmToken) {
            console.info(`Updating FCM token for user ${user}`);
            findUser.fcmToken = fcmToken;
            await findUser.save();
        }

        // Check for existing active rides
        const existingActiveRide = await RideBooking.findOne({
            user: user,
            ride_status: {
                $in: [
                    "pending",
                    "searching",
                    "driver_assigned",
                    "driver_arrived",
                    "in_progress",
                ],
            },
        });

        if (existingActiveRide) {
            return res.status(409).json({
                error: "You already have an active ride request",
                activeRide: existingActiveRide._id,
            });
        }

        // Construct geo points using the schema format
        const pickupLocationGeo = {
            type: "Point",
            coordinates: [pickupLocation.longitude, pickupLocation.latitude],
        };

        const dropLocationGeo = {
            type: "Point",
            coordinates: [dropLocation.longitude, dropLocation.latitude],
        };

        // Get route information (distance, duration, polyline)
        let routeInfo = {};
        try {
            const routeData = await getRouteFromAPI(pickupLocation, dropLocation);
            if (routeData) {
                routeInfo = {
                    distance: routeData.distance,
                    duration: routeData.duration,
                    polyline: routeData.polyline || null,
                    waypoints: routeData.waypoints || [],
                };
            } else {
                // Fallback to calculate straight-line distance
                const straightLineDistance = calculateStraightLineDistance(
                    pickupLocation.latitude,
                    pickupLocation.longitude,
                    dropLocation.latitude,
                    dropLocation.longitude
                );
                routeInfo = {
                    distance: straightLineDistance,
                    duration: Math.round(straightLineDistance * 3), // Rough estimate: 3 minutes per km
                };
            }
        } catch (error) {
            console.warn("Route calculation failed, using fallback:", error.message);
            const straightLineDistance = calculateStraightLineDistance(
                pickupLocation.latitude,
                pickupLocation.longitude,
                dropLocation.latitude,
                dropLocation.longitude
            );
            routeInfo = {
                distance: straightLineDistance,
                duration: Math.round(straightLineDistance * 3),
            };
        }

        // Calculate pricing based on fare object or use default calculation
        let pricingData;
        if (fare && fare.total_fare) {
            pricingData = {
                base_fare: fare.base_fare || 0,
                distance_fare: fare.distance_fare || 0,
                time_fare: fare.time_fare || 0,
                platform_fee: fare.platform_fee || 0,
                night_charge: fare.night_charge || 0,
                rain_charge: fare.rain_charge || 0,
                toll_charge: fare.toll_charge || 0,
                discount: fare.discount || 0,
                total_fare: fare.total_fare,
                currency: fare.currency || "INR",
            };
        } else {
            pricingData = calculateBasePricing(
                vehicleType.toLowerCase(),
                routeInfo.distance || 0
            );
        }

        // Create comprehensive address objects
        const pickupAddressObj = {
            formatted_address: pick_desc,
            street_number: pickupAddress.street_number || null,
            route: pickupAddress.route || null,
            locality: pickupAddress.locality || null,
            administrative_area: pickupAddress.administrative_area || null,
            country: pickupAddress.country || null,
            postal_code: pickupAddress.postal_code || null,
            place_id: pickupAddress.place_id || null,
        };

        const dropAddressObj = {
            formatted_address: drop_desc,
            street_number: dropAddress.street_number || null,
            route: dropAddress.route || null,
            locality: dropAddress.locality || null,
            administrative_area: dropAddress.administrative_area || null,
            country: dropAddress.country || null,
            postal_code: dropAddress.postal_code || null,
            place_id: dropAddress.place_id || null,
        };

        // Create new ride request with the updated schema
        const newRideRequest = new RideBooking({
            pickup_location: pickupLocationGeo,
            pickup_address: pickupAddressObj,
            drop_location: dropLocationGeo,
            drop_address: dropAddressObj,
            route_info: routeInfo,
            user: user,
            user_fcm_token: fcmToken || findUser.fcmToken,
            vehicle_type: vehicleType.toLowerCase(),
            ride_status: "pending",
            requested_at: new Date(),
            scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
            pricing: pricingData,
            payment_method: paymentMethod.toLowerCase(),
            payment_status: "pending",
            search_radius: 5,
            max_search_radius: 25,
            auto_increase_radius: true,
            retry_count: 0,
            rejected_by_drivers: [],
        });

        // Save the ride request
        await newRideRequest.save();

        // Log successful creation
        console.info(`Ride request created successfully`, {
            rideId: newRideRequest._id,
            userId: user,
            vehicleType,
            status: newRideRequest.ride_status,
            totalFare: newRideRequest.pricing.total_fare,
            distance: routeInfo.distance,
        });
        scheduleRideCancellationCheck(redisClient, newRideRequest._id);
        // Start driver search process asynchronously
        setImmediate(() => {
            initiateDriverSearch(newRideRequest._id, req, res).catch((error) => {
                console.error("Driver search failed:", error.message);
            });
        });

        // Prepare comprehensive response data
        const responseData = {
            rideId: newRideRequest._id,
            ride_status: newRideRequest.ride_status,
            ride_otp: newRideRequest.ride_otp,
            pickup_location: newRideRequest.pickup_location,
            drop_location: newRideRequest.drop_location,
            pickup_address: newRideRequest.pickup_address,
            drop_address: newRideRequest.drop_address,
            vehicle_type: newRideRequest.vehicle_type,
            pricing: newRideRequest.pricing,
            payment_method: newRideRequest.payment_method,
            payment_status: newRideRequest.payment_status,
            eta: newRideRequest.eta,
            search_radius: newRideRequest.search_radius,
            requested_at: newRideRequest.requested_at,
            scheduled_at: newRideRequest.scheduled_at,
            route_info: newRideRequest.route_info,
            wait_time: newRideRequest.wait_time,
            retry_count: newRideRequest.retry_count,
            auto_increase_radius: newRideRequest.auto_increase_radius,
        };

        res.status(201).json({
            success: true,
            message: "Ride request created successfully",
            data: responseData,
        });
    } catch (error) {
        console.error("Error creating ride request", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.user,
        });

        // Handle specific validation errors
        if (error.name === "ValidationError") {
            const validationErrors = Object.values(error.errors).map(
                (err) => err.message
            );
            return res.status(400).json({
                success: false,
                error: "Validation failed",
                details: validationErrors,
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: "Duplicate entry detected",
                details: error.message,
            });
        }

        res.status(500).json({
            success: false,
            error: "Server error, please try again",
            ...(process.env.NODE_ENV === "development" && { details: error.message }),
        });
    }
};

const getRouteFromAPI = async (pickup, drop) => {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.warn("Google Maps API key not configured");
            return null;
        }

        const response = await axios.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            {
                params: {
                    origin: `${pickup.latitude},${pickup.longitude}`,
                    destination: `${drop.latitude},${drop.longitude}`,
                    mode: "driving",
                    units: "metric",
                    key: apiKey,
                },
                timeout: 5000,
            }
        );

        if (response.data.status === "OK" && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            const leg = route.legs[0];

            return {
                distance: Math.round(leg.distance.value / 1000), // Convert to km
                duration: Math.round(leg.duration.value / 60), // Convert to minutes
                polyline: route.overview_polyline?.points || null,
                waypoints: [],
            };
        }
    } catch (error) {
        console.warn("Route API error:", error.message);
    }
    return null;
};

const calculateStraightLineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // Round to 2 decimal places
};

const calculateBasePricing = (vehicleType, distance) => {
    const pricingConfig = {
        auto: { baseFare: 30, perKm: 12, perMin: 2 },
        bike: { baseFare: 20, perKm: 8, perMin: 1.5 },
        car: { baseFare: 50, perKm: 15, perMin: 3 },
        suv: { baseFare: 80, perKm: 20, perMin: 4 },
    };

    const config = pricingConfig[vehicleType] || pricingConfig.auto;
    const estimatedDuration = Math.round(distance * 3); // 3 minutes per km estimate

    const baseFare = config.baseFare;
    const distanceFare = Math.round(distance * config.perKm);
    const timeFare = Math.round(estimatedDuration * config.perMin);

    const subtotal = baseFare + distanceFare + timeFare;
    const platformFee = Math.round(subtotal * 0.02);
    const currentHour = new Date().getHours();
    const nightCharge =
        currentHour >= 22 || currentHour <= 6 ? Math.round(subtotal * 0.1) : 0;

    const totalFare = subtotal + platformFee + nightCharge;

    return {
        base_fare: baseFare,
        distance_fare: distanceFare,
        time_fare: timeFare,
        platform_fee: platformFee,
        night_charge: nightCharge,
        rain_charge: 0,
        toll_charge: 0,
        discount: 0,
        total_fare: totalFare,
        currency: "INR",
    };
};

const getRedisClient = (req) => {
    try {
        const redisClient = req.app.get('pubClient');
        if (!redisClient || typeof redisClient.set !== 'function') {
            console.error("Redis client is not properly initialized");
            return null;
        }
        return redisClient;
    } catch (error) {
        console.error("Redis client not available:", error.message);
        return null;
    }
};

const saveRideToRedis = async (redisClient, rideId, rideData) => {
    try {
        if (!redisClient) {
            console.warn("Redis client not available, skipping save to Redis");
            return false;
        }

        const rideKey = `ride:${rideId}`;
        await redisClient.set(rideKey, JSON.stringify(rideData), 'EX', 3600);
        console.info(`Ride ${rideId} saved to Redis`);
        return true;
    } catch (error) {
        console.error("Failed to save ride to Redis:", error.message);
        return false;
    }
};

const saveRidersToRedis = async (redisClient, rideId, riders) => {
    try {
        if (!redisClient) {
            console.warn("Redis client not available, skipping save to Redis");
            return false;
        }

        const ridersKey = `riders:${rideId}`;
        await redisClient.set(ridersKey, JSON.stringify(riders), 'EX', 3600);
        console.info(`${riders.length} riders saved to Redis for ride ${rideId}`);
        return true;
    } catch (error) {
        console.error("Failed to save riders to Redis:", error.message);
        return false;
    }
};

const getRidersFromRedis = async (redisClient, rideId) => {
    try {
        if (!redisClient) {
            console.warn("Redis client not available, skipping fetch from Redis");
            return null;
        }

        const ridersKey = `riders:${rideId}`;
        const ridersData = await redisClient.get(ridersKey);
        if (ridersData) {
            console.info(`Retrieved riders from Redis for ride ${rideId}`);
            return JSON.parse(ridersData);
        }
        return null;
    } catch (error) {
        console.error("Failed to get riders from Redis:", error.message);
        return null;
    }
};

const updateRideStatus = async (redisClient, rideId, status, additionalData = {}) => {
    try {
        console.info(`Updating ride ${rideId} status to: ${status}`);

        const validStatuses = ['pending', 'searching', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid ride status: ${status}`);
        }

        const updateData = {
            ride_status: status,
            updated_at: new Date(),
            ...additionalData
        };

        const updatedRide = await RideBooking.findByIdAndUpdate(
            rideId,
            { $set: updateData },
            { new: true }
        );

        if (!updatedRide) {
            throw new Error("Ride not found");
        }

        console.info(`Ride ${rideId} status updated successfully to ${status}`);

        // Update Redis cache
        await saveRideToRedis(redisClient, rideId, updatedRide);

        return updatedRide;
    } catch (error) {
        console.error(`Failed to update ride ${rideId} status:`, error.message);
        throw error;
    }
};

const initiateDriverSearch = async (rideId, req, res) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 10000;
    const INITIAL_RADIUS = 2500;
    const RADIUS_INCREMENT = 500;
    const MIN_ACTIVE_DRIVERS_THRESHOLD = 1;

    let retryCount = 0;
    const redisClient = getRedisClient(req);

    try {
        console.info(`Initiating driver search for ride: ${rideId}`);

        const ride = await RideBooking.findById(rideId);
        if (!ride) {
            throw new Error("Ride not found");
        }

        if (!['pending', 'searching'].includes(ride.ride_status)) {
            console.info(`Ride ${rideId} is ${ride.ride_status}, stopping search`);
            return { message: `Ride request is ${ride.ride_status}` };
        }

        await updateRideStatus(redisClient, rideId, 'searching', {
            search_started_at: new Date(),
            retry_count: retryCount
        });

        await saveRideToRedis(redisClient, rideId, ride);

        let cachedRiders = await getRidersFromRedis(redisClient, rideId);
        if (cachedRiders && cachedRiders.length > 0) {
            console.info(`Using ${cachedRiders.length} cached riders for ride ${rideId}`);
            return await processRiders(redisClient, rideId, cachedRiders);
        }

        while (retryCount < MAX_RETRIES) {
            try {
                console.info(`Driver search attempt ${retryCount + 1}/${MAX_RETRIES} for ride ${rideId}`);

                const currentRide = await RideBooking.findById(rideId);
                if (!currentRide) {
                    throw new Error("Ride not found during search");
                }

                if (!['pending', 'searching'].includes(currentRide.ride_status)) {
                    console.info(`Ride ${rideId} status changed to ${currentRide.ride_status}, stopping search`);
                    return { message: `Ride status changed to ${currentRide.ride_status}` };
                }

                const pickupCoords = currentRide.pickup_location?.coordinates;
                if (!pickupCoords || pickupCoords.length !== 2) {
                    throw new Error("Invalid pickup coordinates");
                }
                const vehcicleType = (ride.vehicle_type).toUpperCase()
                console.log(vehcicleType)
                const [longitude, latitude] = pickupCoords;
                const currentRadius = INITIAL_RADIUS + (retryCount * RADIUS_INCREMENT);

                console.info(`Searching for drivers within ${currentRadius / 1000} km of coordinates [${longitude}, ${latitude}]`);

                const riders = await RiderModel.aggregate([
                    {
                        $geoNear: {
                            near: {
                                type: "Point",
                                coordinates: [longitude, latitude]
                            },
                            distanceField: "distance",
                            maxDistance: currentRadius,
                            spherical: true,
                        },
                    },
                    {
                        $match: {
                            isAvailable: true,
                            "rideVehicleInfo.vehicleType": vehcicleType,
                            _id: { $nin: currentRide.rejected_by_drivers || [] }
                        },
                    },
                    {
                        $project: {
                            name: 1,
                            phoneNumber: 1,
                            profileImage: 1,
                            rating: 1,
                            fcmToken: 1,
                            location: 1,
                            "rideVehicleInfo.vehicleName": 1,
                            "rideVehicleInfo.vehicleImage": 1,
                            "rideVehicleInfo.VehicleNumber": 1,
                            "rideVehicleInfo.PricePerKm": 1,
                            "rideVehicleInfo.vehicleType": 1,
                            "RechargeData.expireData": 1,
                            on_ride_id: 1,
                            distance: 1,
                            isAvailable: 1,
                            lastActiveAt: 1
                        },
                    },
                    {
                        $sort: { distance: 1 }
                    }
                ]);

                console.info(`Found ${riders.length} riders in radius for ride ${rideId}`);

                if (riders.length === 0) {
                    console.warn(`No riders found in ${currentRadius / 1000} km radius for ride ${rideId}`);
                    retryCount++;

                    await updateRideStatus(redisClient, rideId, 'searching', {
                        retry_count: retryCount,
                        search_radius: currentRadius / 1000,
                        last_search_at: new Date()
                    });

                    if (retryCount < MAX_RETRIES) {
                        console.info(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                        continue;
                    } else {
                        await updateRideStatus(redisClient, rideId, 'cancelled', {
                            cancellation_reason: 'No drivers available',
                            cancelled_at: new Date()
                        });
                        return {
                            success: false,
                            message: "No drivers available in the area"
                        };
                    }
                }

                const currentDate = new Date();
                const validRiders = riders.filter((rider) => {
                    try {
                        const expireDate = rider?.RechargeData?.expireData;
                        const hasValidRecharge = expireDate && new Date(expireDate) >= currentDate;
                        const isFreeRider = !rider?.on_ride_id;
                        const isAvailable = rider?.isAvailable === true;

                        if (!hasValidRecharge) {
                            console.debug(`Rider ${rider._id} filtered: recharge expired (${expireDate})`);
                        }
                        if (!isFreeRider) {
                            console.debug(`Rider ${rider._id} filtered: already on ride (${rider.on_ride_id})`);
                        }
                        if (!isAvailable) {
                            console.debug(`Rider ${rider._id} filtered: not available`);
                        }

                        return hasValidRecharge && isFreeRider && isAvailable;
                    } catch (filterError) {
                        console.warn(`Error filtering rider ${rider._id}:`, filterError.message);
                        return false;
                    }
                });

                console.info(`${validRiders.length} valid riders found out of ${riders.length} total riders for ride ${rideId}`);

                if (validRiders.length >= MIN_ACTIVE_DRIVERS_THRESHOLD) {
                    await saveRidersToRedis(redisClient, rideId, validRiders);
                    return await processRiders(redisClient, rideId, validRiders);
                } else {
                    console.warn(`Only ${validRiders.length} valid riders found, need at least ${MIN_ACTIVE_DRIVERS_THRESHOLD}`);
                    retryCount++;

                    await updateRideStatus(redisClient, rideId, 'searching', {
                        retry_count: retryCount,
                        search_radius: currentRadius / 1000,
                        available_drivers: validRiders.length,
                        last_search_at: new Date()
                    });

                    if (retryCount < MAX_RETRIES) {
                        console.info(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    }
                }

            } catch (searchError) {
                console.error(`Driver search attempt ${retryCount + 1} failed:`, searchError.message);
                retryCount++;

                if (retryCount < MAX_RETRIES) {
                    console.info(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                } else {
                    throw searchError;
                }
            }
        }

        await updateRideStatus(redisClient, rideId, 'cancelled', {
            cancellation_reason: 'Driver search failed after maximum retries',
            cancelled_at: new Date(),
            final_retry_count: retryCount
        });

        return {
            success: false,
            message: "Driver search failed after maximum retries"
        };

    } catch (error) {
        console.error("Driver search initiation failed:", error.message);

        try {
            await updateRideStatus(redisClient, rideId, 'cancelled', {
                cancellation_reason: 'Driver search error: ' + error.message,
                cancelled_at: new Date(),
                last_error: {
                    message: error.message,
                    code: "DRIVER_SEARCH_FAILED",
                    occurred_at: new Date(),
                }
            });
        } catch (updateError) {
            console.error("Failed to update ride with error:", updateError.message);
        }

        throw error;
    }
};



const processRiders = async (redisClient, rideId, riders) => {
    try {
        console.info(`Processing ${riders.length} riders for ride ${rideId}`);

        riders.forEach((rider, index) => {
            console.info(`Rider ${index + 1}: ${rider.name} (${rider._id}) - Distance: ${Math.round(rider.distance)}m, Rating: ${rider.rating || 'N/A'}`);
        });

        await updateRideStatus(redisClient, rideId, 'searching', {
            notifications_sent_to: riders.length,
            notified_riders: riders.map(r => r._id),
            notification_sent_at: new Date()
        });

        return {
            success: true,
            message: `Notifications sent to ${riders.length} riders`,
            riders_count: riders.length
        };

    } catch (error) {
        console.error(`Failed to process riders for ride ${rideId}:`, error.message);
        throw error;
    }
};

exports.ride_status_after_booking = async (req, res) => {
    try {
        const user = Array.isArray(req.user.user)
            ? req.user.user[0]
            : req.user.user;

        if (!user) {
            return res.status(401).json({ message: "Authentication error: User not found." });
        }

        const userId = user?._id;
        const { rideId } = req.params;

        console.log("rideId from params:", rideId);
        console.log("Authenticated userId:", userId);

        if (!rideId) {
            return res.status(400).json({ message: "Ride ID is required." });
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        const ride = await RideBooking.findOne({ _id: rideId }).populate("driver");

        console.log("Fetched Ride:", ride);

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (!ride.user || ride.user.toString() !== userId.toString()) {
            return res.status(403).json({
                message: "Forbidden: You are not authorized to view this ride.",
            });
        }

        let responsePayload = {
            status: ride.ride_status,
            message: "",
            rideDetails: null,
        };

        switch (ride.ride_status) {
            case "pending":
                responsePayload.message = "Your ride request is pending confirmation.";
                break;
            case "searching":
                responsePayload.message = "Searching for a driver near you...";
                break;
            case "driver_assigned":
                responsePayload.message = "Driver assigned! Your ride is on the way.";
                responsePayload.rideDetails = ride.driver ? ride : null;
                break;
            case "driver_arrived":
                responsePayload.message = "Your driver has arrived at the pickup location!";
                responsePayload.rideDetails = ride.driver ? ride : null;
                break;
            case "in_progress":
                responsePayload.message = "Your ride is currently in progress.";
                responsePayload.rideDetails = ride.driver
                    ? {
                          rideId: ride._id,
                          driverId: ride.driver._id,
                      }
                    : null;
                break;
            case "completed":
                responsePayload.message = "Your ride has been completed. Thank you!";
                responsePayload.rideDetails = ride;
                break;
            case "cancelled":
                responsePayload.message = `This ride has been cancelled${ride.cancelledBy ? ` by ${ride.cancelledBy}` : ""}.`;
                responsePayload.rideDetails = ride;
                break;
            default:
                responsePayload.message = "Ride status is unknown or invalid.";
                console.warn(`Ride ${ride._id} has an unhandled status: ${ride.ride_status}`);
                break;
        }

        return res.status(200).json(responsePayload);
    } catch (error) {
        console.error("Error fetching ride status:", error);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid Ride ID format." });
        }
        return res.status(500).json({ message: "Server error while fetching ride status." });
    }
};


// Fetch unassigned rides for a rider
const mongoose = require('mongoose');

exports.riderFetchPoolingForNewRides = async (req, res) => {
    try {
        console.log("pooling",req.query);
        const { riderId } = req.query;

        if (!riderId) {
            return res.status(400).json({ message: "Rider ID is required." });
        }

        const foundRiderDetails = await RiderModel.findOne({ _id: riderId });
        if (!foundRiderDetails) {
            return res.status(404).json({ message: "Rider not found." });
        }

        if (!foundRiderDetails.isAvailable) {
            return res.status(400).json({ message: "Rider is not available for new rides." });
        }

        const redisClient = getRedisClient(req);
        let availableRides = [];

        // Time cutoff: 1.5 minutes ago
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - 240 * 1000); // 90 seconds ago

        // Check Redis for recent unassigned rides
        const cachedRidesKeys = await redisClient.keys('ride:*');

        for (const rideKey of cachedRidesKeys) {
            const rideData = await redisClient.get(rideKey);
            if (rideData) {
                const ride = JSON.parse(rideData);
                const rideTime = new Date(ride.requested_at);

                if (
                    ride.ride_status === 'searching' &&
                    new Date(rideTime) >= cutoffTime &&
                    !ride.rejected_by_drivers?.some(r => r.driver === riderId) &&
                    ride.vehicle_type?.toUpperCase() === foundRiderDetails.rideVehicleInfo.vehicleType
                ) {
                    availableRides.push(ride); // Push full ride
                }
            }
        }

        // Check DB for recent rides
        const dbRides = await RideBooking.find({
            ride_status: 'searching',
            vehicle_type: foundRiderDetails.rideVehicleInfo.vehicleType.toLowerCase(),
            requested_at: { $gte: cutoffTime },
            rejected_by_drivers: {
                $not: {
                    $elemMatch: { driver: new mongoose.Types.ObjectId(riderId) }
                }
            }
        }).sort({ requested_at: -1 }).limit(1);

        availableRides.push(...dbRides);

        // Remove duplicate rides by ID
        const uniqueRidesMap = new Map();
        for (const ride of availableRides) {
            const id = ride._id?.toString();
            if (id && !uniqueRidesMap.has(id)) {
                uniqueRidesMap.set(id, ride);
            }
        }

        // Convert map back to array and limit to 2 rides
        const recentRides = Array.from(uniqueRidesMap.values()).slice(0, 2);

        console.info(`Found ${recentRides.length} recent rides for rider ${riderId}`);

        return res.status(200).json({
            success: true,
            message: `Found ${recentRides.length} available rides`,
            data: recentRides
        });
    } catch (error) {
        console.error("Error fetching rides for rider:", error.message);
        return res.status(500).json({ message: "Server error while fetching rides." });
    }
};


// Handle rider accepting or rejecting a ride
exports.riderActionAcceptOrRejectRide = async (req, res) => {
    try {
        const { riderId, rideId, action } = req.query;
        if (!riderId || !rideId || !action) {
            return res.status(400).json({ message: "Rider ID, Ride ID, and action are required." });
        }
        if (!['accept', 'reject'].includes(action.toLowerCase())) {
            return res.status(400).json({ message: "Invalid action. Must be 'accept' or 'reject'." });
        }
        const rider = await RiderModel.findById(riderId);
        if (!rider) {
            return res.status(404).json({ message: "Rider not found." });
        }
        if (!rider.isAvailable || rider.on_ride_id) {
            return res.status(400).json({ message: "Rider is not available or is already on a ride." });
        }
        const ride = await RideBooking.findById(rideId).populate('user driver');
        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }
        if (ride.ride_status !== 'searching') {
            return res.status(400).json({ message: `Ride is in ${ride.ride_status} status, cannot perform action.` });
        }
        const redisClient = getRedisClient(req);
        if (action.toLowerCase() === 'reject') {
            // Add rider to rejected_by_drivers list
            await RideBooking.findByIdAndUpdate(
                rideId,
                { $addToSet: { rejected_by_drivers: riderId } },
                { new: true }
            );
            // Remove rider from Redis riders list
            let cachedRiders = await getRidersFromRedis(redisClient, rideId);
            if (cachedRiders) {
                cachedRiders = cachedRiders.filter(r => r._id.toString() !== riderId);
                await saveRidersToRedis(redisClient, rideId, cachedRiders);
            }
            console.info(`Rider ${riderId} rejected ride ${rideId}`);
            return res.status(200).json({
                success: true,
                message: "Ride rejected successfully."
            });
        } else {
            // Accept ride
            const updatedRide = await updateRideStatus(redisClient, rideId, 'driver_assigned', {
                rider: riderId,
                driver_assigned_at: new Date(),
                eta: 5 // Default ETA, can be calculated based on distance
            });
            // Update rider status
            await RiderModel.findByIdAndUpdate(riderId, {
                $set: {
                    isAvailable: false,
                    on_ride_id: rideId
                }
            });
            // Notify user
            if (updatedRide.user && updatedRide.user.fcmToken) {
                await sendNotification.sendNotification(
                    updatedRide.user.fcmToken,
                    "Ride Accepted",
                    "Your ride request has been accepted!",
                    {
                        event: 'RIDE_ACCEPTED',
                        eta: 5,
                        message: 'Your ride request has been accepted!',
                        rideDetails: {
                            rideId: updatedRide._id,
                            pickup: updatedRide.pickup_address,
                            drop: updatedRide.drop_address,
                            vehicleType: updatedRide.vehicle_type,
                            pricing: updatedRide.pricing,
                            driverName: rider.name,
                            vehicleDetails: rider.rideVehicleInfo
                        },
                        screen: 'TrackRider',
                        riderId: rider.name,
                    }
                );
            }
            // Notify other riders to remove this ride from their pool
            let cachedRiders = await getRidersFromRedis(redisClient, rideId);
            if (cachedRiders) {
                const otherRiders = cachedRiders.filter(r => r._id.toString() !== riderId);
                for (const otherRider of otherRiders) {
                    if (otherRider.fcmToken) {
                        await sendNotification.sendNotification(
                            otherRider.fcmToken,
                            "Ride Unavailable",
                            "The ride you were considering is no longer available.",
                            {
                                event: 'RIDE_UNAVAILABLE',
                                rideId: rideId,
                                message: 'The ride you were considering is no longer available.',
                                screen: 'RiderDashboard'
                            }
                        );
                    }
                }
                // Clear riders from Redis
                await redisClient.del(`riders:${rideId}`);
            }
            console.info(`Rider ${riderId} accepted ride ${rideId}`);
            return res.status(200).json({
                success: true,
                message: "Ride accepted successfully.",
                data: {
                    rideId: updatedRide._id,
                    pickup: updatedRide.pickup_address,
                    drop: updatedRide.drop_address,
                    vehicleType: updatedRide.vehicle_type,
                    pricing: updatedRide.pricing,
                }
            });
        }
    } catch (error) {
        console.error(`Error in rider action for ride ${req.query.rideId}:`, error.message);
        return res.status(500).json({ message: "Server error while processing rider action." });
    }
};

exports.ride_status_after_booking_for_drivers = async (req, res) => {
    try {

        const { rideId } = req.params;
        if (!rideId) {
            return res.status(400).json({ message: "Ride ID is required." });
        }
        const ride = await RideBooking.findOne({ _id: rideId })
            .populate("driver user")
            .lean();
        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        let responsePayload = {
            status: ride.ride_status,
            message: "",
            rideDetails: null,
        };
        switch (ride.ride_status) {
            case "pending":
                responsePayload.message = "Your ride request is pending confirmation.";
                responsePayload.rideDetails = {
                    rideId: ride._id,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    vehicleType: ride.vehicle_type,
                    pricing: ride.pricing,
                    requestedAt: ride.requested_at,
                };
                break;
            case "searching":
                responsePayload.message = "Searching for a driver near you...";
                responsePayload.rideDetails = {
                    rideId: ride._id,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    vehicleType: ride.vehicle_type,
                    pricing: ride.pricing,
                    searchRadius: ride.search_radius,
                    retryCount: ride.retry_count,
                };
                break;
            case "driver_assigned":
                responsePayload.message = "Driver assigned! Your ride is on the way.";
                responsePayload.rideDetails = ride.driver ? {
                    rideId: ride._id,
                    driverId: ride.driver._id,
                    driverName: ride.driver.name,
                    vehicleType: ride.vehicle_type,
                    vehicleDetails: ride.driver.rideVehicleInfo,
                    eta: ride.eta || 5,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    pricing: ride.pricing,
                } : null;
                break;
            case "driver_arrived":
                responsePayload.message = "Your driver has arrived at the pickup location!";
                responsePayload.rideDetails = ride.driver ? {
                    rideId: ride._id,
                    driverId: ride.driver._id,
                    driverName: ride.driver.name,
                    vehicleType: ride.vehicle_type,
                    vehicleDetails: ride.driver.rideVehicleInfo,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    pricing: ride.pricing,
                } : null;
                break;
            case "in_progress":
                responsePayload.message = "Your ride is currently in progress.";
                responsePayload.rideDetails = ride.driver ? {
                    rideId: ride._id,
                    driverId: ride.driver._id,
                    driverName: ride.driver.name,
                    vehicleType: ride.vehicle_type,
                    vehicleDetails: ride.driver.rideVehicleInfo,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    pricing: ride.pricing,
                } : null;
                break;
            case "completed":
                responsePayload.message = "Your ride has been completed. Thank you!";
                responsePayload.rideDetails = {
                    rideId: ride._id,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    vehicleType: ride.vehicle_type,
                    pricing: ride.pricing,
                    completedAt: ride.completed_at || new Date(),
                };
                break;
            case "cancelled":
                responsePayload.message = `This ride has been cancelled${ride.cancelledBy ? ` by ${ride.cancelledBy}` : ""}.`;
                responsePayload.rideDetails = {
                    rideId: ride._id,
                    pickup: ride.pickup_address,
                    drop: ride.drop_address,
                    vehicleType: ride.vehicle_type,
                    pricing: ride.pricing,
                    cancellationReason: ride.cancellation_reason || "Unknown",
                    cancelledAt: ride.cancelled_at || new Date(),
                };
                break;
            default:
                responsePayload.message = "Ride status is unknown or invalid.";
                console.warn(`Ride ${ride._id} has an unhandled status: ${ride.ride_status}`);
                break;
        }
        return res.status(200).json({
            success:true,
            data:ride
        });
    } catch (error) {
        console.error("Error fetching ride status:", error);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid Ride ID format." });
        }
        return res.status(500).json({ message: "Server error while fetching ride status." });
    }
};