const RideBooking = require("./NewRideModel.model");
const axios = require("axios");
const User = require("../../models/normal_user/User.model");
const RiderModel = require("../../models/Rider.model");

const sendNotification = require("../../utils/sendNotification");




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
    console.log("rideId", rideId)
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

const updateRideStatus = async (redisClient, rideId, status, additionalData = {}, riderId) => {
    try {
        console.info(`Updating ride ${rideId} status to: ${status}`);

        const validStatuses = ['pending', 'searching', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid ride status: ${status}`);
        }

        const updateData = {
            ride_status: status,
            driver: riderId,
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



const processRiders = async (redisClient, rideId, riders, rideDetails = {}) => {
    try {
        console.info(`🚀 Processing ${riders.length} riders for ride ${rideId}`);

        // Log rider details
        riders.forEach((rider, index) => {
            console.info(
                `Rider ${index + 1}: ${rider.name} (${rider._id}) - Distance: ${Math.round(rider.distance || 0)}m, Rating: ${rider.rating || 'N/A'}`
            );
        });

        // Send notifications in parallel
        const notificationPromises = riders.map(async (rider) => {
            console.log("rider",rider?.fcmToken)
            if (!rider?.fcmToken) {
                console.warn(`⚠️ Rider ${rider._id} has no FCM token, skipping notification.`);
                return;
            }

            const payload = {
                event: 'NEW_RIDE_REQUEST',
                rideId,
                eta: rider.distance ? Math.ceil(rider.distance / 300) : 5, // example ETA calc
                pickup: rideDetails.pickup || '',
                priority: "high",
                sound: 'sound',
                drop: rideDetails.drop || '',
                vehicleType: rideDetails.vehicleType || '',
                pricing: rideDetails.pricing || {},
                screen: 'RideRequestModal', // suggested screen in rider app
            };

            console.info(`📨 Sending ride request to Rider ${rider._id}`);

            return sendNotification.sendNotification(
                rider.fcmToken,
                "🚖 New Ride Request",
                "You have a new ride nearby. Tap to view details.",
                payload
            );
        });

        await Promise.all(notificationPromises);

        // Update ride in Redis
        await updateRideStatus(redisClient, rideId, 'searching', {
            notifications_sent_to: riders.length,
            notified_riders: riders.map(r => r._id),
            notification_sent_at: new Date(),
        });

        console.info(`✅ Notifications sent to ${riders.length} riders`);

        return {
            success: true,
            message: `Notifications sent to ${riders.length} riders`,
            riders_count: riders.length
        };

    } catch (error) {
        console.error(`❌ Failed to process riders for ride ${rideId}:`, error.message);
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

        // console.log("Fetched Ride:", ride);

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
                responsePayload.rideDetails = ride
                break;
            case "driver_assigned":
                responsePayload.message = "Driver assigned! Your ride is on the way.";
                responsePayload.rideDetails = ride;
                break;
            case "driver_arrived":
                responsePayload.message = "Your driver has arrived at the pickup location!";
                responsePayload.rideDetails = ride;
                break;
            case "in_progress":
                responsePayload.message = "Your ride is currently in progress.";
                responsePayload.rideDetails = ride
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
const SendWhatsAppMessageNormal = require("../../utils/normalWhatsapp");

exports.riderFetchPoolingForNewRides = async (req, res) => {
    try {
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

        // Time cutoff: 4 minutes ago (240 seconds)
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - 240 * 1000);

        // Check Redis for recent unassigned rides
        const cachedRidesKeys = await redisClient.keys('ride:*');

        for (const rideKey of cachedRidesKeys) {
            const rideData = await redisClient.get(rideKey);
            if (rideData) {
                try {
                    const ride = JSON.parse(rideData);
                    const rideTime = new Date(ride.requested_at);

                    // Check if ride meets basic criteria
                    if (
                        ride.ride_status === 'searching' &&
                        new Date(rideTime) >= cutoffTime &&
                        !ride.rejected_by_drivers?.some(r => r.driver === riderId) &&
                        ride.vehicle_type?.toUpperCase() === foundRiderDetails.rideVehicleInfo.vehicleType
                    ) {
                        // Double-check ride status from database before adding
                        const dbRide = await RideBooking.findById(ride._id);

                        if (dbRide) {
                            // Check if ride is still available
                            if (dbRide.ride_status === 'searching') {
                                availableRides.push(dbRide);
                            } else if (dbRide.ride_status === 'cancelled' || dbRide.ride_status === 'driver_assigned') {
                                // Update Redis with latest status or remove if cancelled/assigned
                                if (dbRide.ride_status === 'cancelled') {
                                    console.log(`Removing cancelled ride ${ride._id} from Redis`);
                                    await redisClient.del(rideKey);
                                } else {
                                    console.log(`Updating Redis for assigned ride ${ride._id}`);
                                    await redisClient.set(rideKey, JSON.stringify(dbRide), 'EX', 3600); // Update with latest data
                                }
                            }
                        } else {
                            // Ride not found in DB, remove from Redis
                            console.log(`Removing non-existent ride ${ride._id} from Redis`);
                            await redisClient.del(rideKey);
                        }
                    }
                } catch (parseError) {
                    console.error(`Error parsing Redis data for key ${rideKey}:`, parseError);
                    // Remove corrupted data from Redis
                    await redisClient.del(rideKey);
                }
            }
        }

        // Check DB for recent rides with status verification
        const dbRides = await RideBooking.find({
            ride_status: 'searching', // Only get rides that are still searching
            vehicle_type: foundRiderDetails.rideVehicleInfo.vehicleType.toLowerCase(),
            requested_at: { $gte: cutoffTime },
            rejected_by_drivers: {
                $not: {
                    $elemMatch: { driver: new mongoose.Types.ObjectId(riderId) }
                }
            }
        }).sort({ requested_at: -1 }).limit(3);

        // Add DB rides to available rides
        availableRides.push(...dbRides);

        // Remove duplicate rides by ID and ensure all rides are still 'searching'
        const uniqueRidesMap = new Map();
        const validRides = [];

        for (const ride of availableRides) {
            const id = ride._id?.toString();
            if (id && !uniqueRidesMap.has(id)) {
                // Final status check before adding to response
                if (ride.ride_status === 'searching') {
                    uniqueRidesMap.set(id, ride);
                    validRides.push(ride);

                    // Update/sync Redis with valid ride data
                    const rideKey = `ride:${id}`;
                    await redisClient.set(rideKey, JSON.stringify(ride), 'EX', 3600); // Cache for 1 hour
                }
            }
        }

        // Convert map back to array and limit to 2 rides
        const recentRides = Array.from(uniqueRidesMap.values()).slice(0, 2);

        // Log for debugging
        console.info(`Found ${recentRides.length} recent rides for rider ${riderId}`);

        if (recentRides.length > 0) {
            console.info(`Ride IDs: ${recentRides.map(r => r._id).join(', ')}`);
            console.info(`Ride statuses: ${recentRides.map(r => r.ride_status).join(', ')}`);
        }

        return res.status(200).json({
            success: true,
            message: `Found ${recentRides.length} available rides`,
            data: recentRides
        });

    } catch (error) {
        console.error("Error fetching rides for rider:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching rides.",
            error: error.message
        });
    }
};

// Helper function to clean up Redis cache (can be called periodically)
exports.cleanupRedisRideCache = async (req, res) => {
    try {
        const redisClient = getRedisClient(req);
        const cachedRidesKeys = await redisClient.keys('ride:*');
        let cleanedCount = 0;

        for (const rideKey of cachedRidesKeys) {
            const rideData = await redisClient.get(rideKey);
            if (rideData) {
                try {
                    const ride = JSON.parse(rideData);

                    // Check if ride exists in database
                    const dbRide = await RideBooking.findById(ride._id);

                    if (!dbRide || dbRide.ride_status === 'cancelled' || dbRide.ride_status === 'completed') {
                        await redisClient.del(rideKey);
                        cleanedCount++;
                        console.log(`Cleaned up ride ${ride._id} from Redis`);
                    } else if (dbRide.ride_status !== ride.ride_status) {
                        // Update Redis with latest status
                        await redisClient.set(rideKey, JSON.stringify(dbRide), 'EX', 3600);
                        console.log(`Updated ride ${ride._id} status in Redis`);
                    }
                } catch (parseError) {
                    await redisClient.del(rideKey);
                    cleanedCount++;
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `Cleaned up ${cleanedCount} rides from Redis cache`
        });

    } catch (error) {
        console.error("Error cleaning up Redis cache:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while cleaning up cache.",
            error: error.message
        });
    }
};
// Handle rider accepting or rejecting a ride
exports.riderActionAcceptOrRejectRide = async (req, res) => {
    try {
        const { riderId, rideId, action } = req.body;
        console.log("🚦 Rider Action Request:", { riderId, rideId, action });

        // Basic validation
        if (!riderId || !rideId || !action) {
            return res.status(400).json({
                message: "Rider ID, Ride ID, and action are required.",
            });
        }

        if (!["accept", "reject"].includes(action.toLowerCase())) {
            return res.status(400).json({
                message: "Invalid action. Must be 'accept' or 'reject'.",
            });
        }

        // Convert string IDs to ObjectId if needed
        const riderObjectId = typeof riderId === 'string' ? new mongoose.Types.ObjectId(riderId) : riderId;
        const rideObjectId = typeof rideId === 'string' ? new mongoose.Types.ObjectId(rideId) : rideId;

        const rider = await RiderModel.findById(riderObjectId);
        if (!rider) {
            return res.status(404).json({ message: "Rider not found." });
        }

        if (!rider.isAvailable || rider.on_ride_id) {
            return res.status(400).json({
                message: "Rider is not available or is already on a ride.",
            });
        }

        const ride = await RideBooking.findById(rideObjectId).populate("user driver");
        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (ride.ride_status !== "searching") {
            return res.status(400).json({
                message: `Ride is in ${ride.ride_status} status, cannot perform action.`,
            });
        }

        const redisClient = getRedisClient(req);

        // ----------------------------
        // 🚫 REJECT FLOW
        // ----------------------------
        if (action.toLowerCase() === "reject") {
            await RideBooking.findByIdAndUpdate(
                rideObjectId,
                { $addToSet: { rejected_by_drivers: riderObjectId } },
                { new: true }
            );

            // Remove from Redis rider list
            let cachedRiders = await getRidersFromRedis(redisClient, rideId);
            if (cachedRiders) {
                cachedRiders = cachedRiders.filter((r) => {
                    const rId = typeof r === "string" ? r : r._id?.toString();
                    return rId !== riderId;
                });

                await saveRidersToRedis(redisClient, rideId, cachedRiders);
            }

            console.info(`🚫 Rider ${riderId} rejected ride ${rideId}`);
            return res.status(200).json({
                success: true,
                message: "Ride rejected successfully.",
            });
        }

        // ----------------------------
        // ✅ ACCEPT FLOW
        // ----------------------------

        // Method 1: Direct MongoDB update (Recommended)
        const updatedRide = await RideBooking.findByIdAndUpdate(
            rideObjectId,
            {
                $set: {
                    ride_status: "driver_assigned",
                    driver: riderObjectId, // Use ObjectId instead of string
                    driver_assigned_at: new Date(),
                    eta: 5,
                    updated_at: new Date()
                }
            },
            { new: true, runValidators: true }
        ).populate("user driver");

        // Alternative Method 2: If you must use updateRideStatus function
        // Make sure it accepts proper ObjectIds
        /*
        const updatedRide = await updateRideStatus(
          redisClient,
          rideObjectId, // Pass ObjectId instead of string
          "driver_assigned",
          {
            driver: riderObjectId, // Use ObjectId instead of string
            driver_assigned_at: new Date(),
            eta: 5,
          },
          riderObjectId // Pass ObjectId instead of string
        );
        */

        if (!updatedRide) {
            return res.status(500).json({
                message: "Failed to update ride status.",
            });
        }

        // Update rider status
        await RiderModel.findByIdAndUpdate(riderObjectId, {
            $set: {
                isAvailable: false,
                on_ride_id: rideObjectId,
            },
        });

        // Notify user
        if (updatedRide.user?.fcmToken) {
            await sendNotification.sendNotification(
                updatedRide.user.fcmToken,
                "Ride Accepted",
                "Your ride request has been accepted!",
                {
                    event: "RIDE_ACCEPTED",
                    eta: 5,
                    message: "Your ride request has been accepted!",
                    rideDetails: {
                        rideId: updatedRide._id.toString(),
                        pickup: updatedRide.pickup_address,
                        drop: updatedRide.drop_address,
                        vehicleType: updatedRide.vehicle_type,
                        pricing: updatedRide.pricing,
                        driverName: rider.name,
                        vehicleDetails: rider.rideVehicleInfo,
                    },
                    screen: "TrackRider",
                    riderId: rider.name,
                }
            );
        }

        // Notify other riders and clear Redis
        let cachedRiders = await getRidersFromRedis(redisClient, rideId);
        if (cachedRiders) {
            const otherRiders = cachedRiders.filter((r) => {
                const rId = typeof r === "string" ? r : r._id?.toString();
                return rId !== riderId;
            });

            for (const otherRider of otherRiders) {
                const token =
                    typeof otherRider === "string" ? null : otherRider.fcmToken;

                if (token) {
                    await sendNotification.sendNotification(
                        token,
                        "Ride Unavailable",
                        "The ride you were considering is no longer available.",
                        {
                            event: "RIDE_UNAVAILABLE",
                            rideId: rideId,
                            message: "The ride you were considering is no longer available.",
                            screen: "RiderDashboard",
                        }
                    );
                }
            }

            await redisClient.del(`riders:${rideId}`);
        }

        console.info(`✅ Rider ${riderId} accepted ride ${rideId}`);
        return res.status(200).json({
            success: true,
            message: "Ride accepted successfully.",
            data: {
                rideId: updatedRide._id.toString(),
                pickup: updatedRide.pickup_address,
                drop: updatedRide.drop_address,
                vehicleType: updatedRide.vehicle_type,
                pricing: updatedRide.pricing,
                driverName: rider.name,
                vehicleDetails: rider.rideVehicleInfo,
            },
        });
    } catch (error) {
        console.error(
            `❌ Error in rider action for ride ${req.body.rideId || "unknown"}:`,
            error.message,
            error.stack
        );
        return res
            .status(500)
            .json({ message: "Server error while processing rider action." });
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
            success: true,
            data: ride
        });
    } catch (error) {
        console.error("Error fetching ride status:", error);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid Ride ID format." });
        }
        return res.status(500).json({ message: "Server error while fetching ride status." });
    }
};


exports.changeCurrentRiderRideStatus = async (req, res) => {
    try {
        const validStatus = ['driver_arrived', 'completed', 'cancelled'];
        const { riderId, rideId, status } = req.body;

        if (!riderId || !rideId || !status) {
            return res.status(400).json({ error: 'Missing riderId, rideId, or status' });
        }

        if (!validStatus.includes(status)) {
            return res.status(400).json({ error: 'Invalid ride status' });
        }

        const foundRide = await RideBooking.findById(rideId)
            .populate('driver')
            .populate('user');

        if (!foundRide) {
            return res.status(404).json({ error: 'Ride not found' });
        }

        if (foundRide.ride_status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot update a cancelled ride' });
        }

        if (foundRide.ride_status === 'completed') {
            return res.status(400).json({ error: 'Ride is already completed' });
        }

        if (foundRide.ride_status === 'driver_arrived' && status === 'driver_arrived') {
            return res.status(400).json({ error: 'Ride is already marked as driver arrived' });
        }

        const { driver, user } = foundRide;

        // Handle status transitions and send appropriate notifications
        if (status === 'driver_arrived') {
            foundRide.ride_status = 'driver_arrived';
            foundRide.driver_arrived_at = new Date();

            if (user?.fcmToken || foundRide.user_fcm_token) {
                await sendNotification.sendNotification(
                    user.fcmToken || foundRide.user_fcm_token,
                    "Your Driver Has Arrived",
                    `Driver ${driver?.name || ''} has arrived at your pickup location.`,
                    {
                        event: 'DRIVER_ARRIVED',
                        rideId: foundRide._id,
                    }
                );
            }
        }

        if (status === 'completed') {
            foundRide.ride_status = 'completed';
            foundRide.ride_ended_at = new Date();

            if (user?.fcmToken || foundRide.user_fcm_token) {
                await sendNotification.sendNotification(
                    user.fcmToken || foundRide.user_fcm_token,
                    "Ride Completed",
                    "Thank you for riding with us. Please rate your experience!",
                    {
                        event: 'RIDE_COMPLETED',
                        rideId: foundRide._id,
                    }
                );
            }

            // Notify the driver if FCM token exists
            if (driver?.fcmToken) {
                await sendNotification.sendNotification(
                    driver.fcmToken,
                    "Ride Completed",
                    "You've successfully completed the ride. Great job!",
                    {
                        event: 'RIDE_COMPLETED_DRIVER',
                        rideId: foundRide._id,
                    }
                );
            }

            // Notify the user if FCM token exists
            if (foundRide.user?.fcmToken) {
                await sendNotification.sendNotification(
                    foundRide.user.fcmToken,
                    "Ride Completed",
                    "Your ride has been successfully completed. Thank you for riding with us!",
                    {
                        event: 'RIDE_COMPLETED_USER',
                        rideId: foundRide._id,
                    }
                );
            }

        }

        if (status === 'cancelled') {
            foundRide.ride_status = 'cancelled';

            if (user?.fcmToken || foundRide.user_fcm_token) {
                await sendNotification.sendNotification(
                    user.fcmToken || foundRide.user_fcm_token,
                    "Ride Cancelled",
                    "Your ride has been cancelled. We hope to serve you again.",
                    {
                        event: 'RIDE_CANCELLED',
                        rideId: foundRide._id,
                    }
                );
            }

            if (driver?.fcmToken) {
                await sendNotification.sendNotification(
                    driver.fcmToken,
                    "Ride Cancelled",
                    "The ride has been cancelled. Awaiting next request.",
                    {
                        event: 'RIDE_CANCELLED_DRIVER',
                        rideId: foundRide._id,
                    }
                );
            }
        }

        await foundRide.save();

        return res.status(200).json({
            success: true,
            message: `Ride status updated to ${status}`,
            ride: foundRide,
        });

    } catch (error) {
        console.error("Error changing ride status:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


exports.verifyRideOtp = async (req, res) => {
    try {
        const { riderId, rideId, otp } = req.body;

        // Validate required fields
        if (!riderId || !rideId || !otp) {
            return res.status(400).json({ error: 'Missing riderId, rideId, or otp' });
        }

        const foundRide = await RideBooking.findById(rideId)
            .populate('driver')
            .populate('user');

        if (!foundRide) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        const { user, driver } = foundRide;

        if (foundRide.ride_status === 'cancelled') {
            if (user?.fcmToken) {
                await sendNotification.sendNotification(
                    user.fcmToken,
                    "Ride Verification Failed",
                    "Ride has already been cancelled.",
                    { event: 'RIDE_CANCELLED', rideId }
                );
            }
            return res.status(400).json({ message: 'Cannot update a cancelled ride' });
        }

        if (foundRide.ride_status === 'completed') {
            if (user?.fcmToken) {
                await sendNotification.sendNotification(
                    user.fcmToken,
                    "Ride Verification Failed",
                    "Ride is already marked as completed.",
                    { event: 'RIDE_ALREADY_COMPLETED', rideId }
                );
            }
            return res.status(400).json({ message: 'Ride is already completed' });
        }

        if (foundRide.ride_status !== 'driver_arrived') {
            if (driver?.fcmToken) {
                await sendNotification.sendNotification(
                    driver.fcmToken,
                    "Cannot Start Ride",
                    "You must mark 'Driver Arrived' before verifying OTP.",
                    { event: 'DRIVER_NOT_ARRIVED', rideId }
                );
            }
            return res.status(400).json({ message: 'Please mark as arrived at the customer location' });
        }

        // OTP check
        if (foundRide.ride_otp !== otp) {
            if (user?.fcmToken) {
                await sendNotification.sendNotification(
                    user.fcmToken,
                    "Invalid OTP",
                    "The OTP you entered is incorrect. Please try again.",
                    { event: 'INVALID_OTP', rideId }
                );
            }
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // OTP is valid – mark ride as in progress
        foundRide.ride_status = 'in_progress';
        foundRide.ride_started_at = new Date();
        await foundRide.save();

        // Send success notification
        if (user?.fcmToken) {
            await sendNotification.sendNotification(
                user.fcmToken,
                "Ride Started",
                "Your ride has started. Enjoy the journey!",
                { event: 'RIDE_STARTED', rideId }
            );
        }

        if (driver?.fcmToken) {
            await sendNotification.sendNotification(
                driver.fcmToken,
                "Ride Started",
                "OTP verified. You can now begin the ride.",
                { event: 'RIDE_STARTED_DRIVER', rideId }
            );
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully. Ride is now in progress.",
            ride: foundRide,
        });

    } catch (error) {
        console.error("❌ OTP verification error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};



exports.collectPayment = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { riderId, rideId, amount, mode } = req.body;

        if (!riderId || !rideId || !mode || !amount) {
            return res.status(400).json({ message: 'Missing required fields: riderId, rideId, amount, or payment mode.' });
        }

        session.startTransaction();

        const foundRide = await RideBooking.findById(rideId)
            .populate('driver')
            .populate('user')
            .session(session);

        if (!foundRide) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Ride not found.' });
        }

        const { user, driver, pricing } = foundRide;

        if (foundRide.ride_status === 'cancelled') {
            await session.abortTransaction();

            if (user?.fcmToken) {
                await sendNotification.sendNotification(
                    user.fcmToken,
                    "Payment Failed",
                    "Cannot pay for a cancelled ride.",
                    { event: 'PAYMENT_CANCELLED', rideId }
                );
            }

            return res.status(400).json({ message: 'Cannot collect payment for a cancelled ride.' });
        }
        console.log("driver", driver)
        const foundRiders = await RiderModel.findById(driver)

        // if (foundRide.ride_status === 'completed') {
        //     await session.abortTransaction();
        //     return res.status(400).json({ message: 'Ride is already completed.' });
        // }

        const totalFare = pricing?.total_fare
        const paidAmount = parseFloat(amount);

        if (isNaN(paidAmount) || paidAmount <= 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Invalid payment amount.' });
        }

        if (paidAmount > totalFare) {
            await session.abortTransaction();
            return res.status(400).json({ message: `Payment exceeds total fare. Expected ≤ ₹${totalFare}` });
        }

        foundRide.payment_method = mode;
        foundRide.payment_status = 'completed';
        foundRide.ride_status = 'completed';
        foundRide.ride_ended_at = new Date();
        foundRide.pricing.collected_amount = paidAmount;

        if (foundRiders) {
            foundRiders.isAvailable = true;
            foundRiders.on_ride_id = null;
        }

        const rechargeDateRaw = foundRiders?.RechargeData?.whichDateRecharge;
        const rechargeDate = rechargeDateRaw ? new Date(rechargeDateRaw) : null;

        if (rechargeDate && !isNaN(rechargeDate.getTime())) {
            const pastRides = await RideBooking.find({
                driver: foundRiders._id,
                ride_status: "completed",
                createdAt: { $gte: rechargeDate }
            }).session(session);

            const pastEarnings = pastRides.reduce((acc, ride) => acc + Number(ride.pricing.collected_amount || 0), 0);
            const currentEarning = Number(foundRide.pricing.collected_amount || 0);
            const totalEarnings = pastEarnings + currentEarning;
            const earningLimit = Number(foundRiders?.RechargeData?.onHowManyEarning || 0);
            const remaining = earningLimit - totalEarnings;
            const number = foundRiders?.phone;

            if (totalEarnings >= earningLimit) {
                await SendWhatsAppMessageNormal(
                    `🎉 You've reached your earning limit for your current plan. Please recharge to continue receiving rides.`,
                    number
                );

                foundRiders.isAvailable = false;
                foundRiders.RechargeData = {
                    expireData: new Date(Date.now() - 5 * 60 * 1000),
                    rechargePlan: '',
                    onHowManyEarning: '',
                    approveRecharge: false,
                    whichDateRecharge: null
                };
                foundRiders.isPaid = false;
            } else if (remaining < 300) {
                await SendWhatsAppMessageNormal(
                    `🛎️ Reminder: You have ₹${remaining} left in your current plan. Please recharge soon to avoid interruptions.`,
                    number
                );
            }
        }

        await foundRide.save({ session });
        if (foundRiders) await foundRiders.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Send FCM Notifications after transaction
        if (user?.fcmToken) {
            await sendNotification.sendNotification(
                user.fcmToken,
                "Payment Successful",
                `You paid ₹${paidAmount} via ${mode}. Ride completed successfully.`,
                {
                    event: 'PAYMENT_SUCCESS',
                    rideId,
                    amount: paidAmount,
                    method: mode,
                }
            );
        }

        if (foundRiders?.fcmToken) {
            await sendNotification.sendNotification(
                foundRiders.fcmToken,
                "Payment Collected",
                `You collected ₹${paidAmount} via ${mode}.`,
                {
                    event: 'PAYMENT_COLLECTED',
                    rideId,
                    amount: paidAmount,
                    method: mode,
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: "✅ Payment collected. Ride marked as completed.",
            ride: foundRide,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error("❌ Payment Collection Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.cancelRideByPoll = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { ride, cancelBy, reason_id, reason } = req.body;
        console.log("📥 Cancel Ride Request Body:", req.body);

        if (!ride || !cancelBy) {
            console.log("❌ Missing ride or cancelBy");
            return res.status(400).json({
                success: false,
                message: "Ride ID and cancelBy are required.",
            });
        }

        await session.withTransaction(async () => {
            const rideData = await RideBooking.findById(ride)
                .populate('driver user')
                .session(session);

            if (!rideData) {
                throw new Error("Ride not found");
            }

            if (rideData.ride_status === "cancelled" || rideData.ride_status === "completed") {
                throw new Error(`Ride is already ${rideData.ride_status}`);
            }

            console.log("🚨 Cancelling ride...");
            rideData.ride_status = "cancelled";
            rideData.payment_status = "cancelled";
            rideData.cancelled_by = cancelBy;
            rideData.cancelled_at = new Date();
            rideData.cancellation_reason = reason || null;

            if (rideData?.driver) {
                console.log("♻️ Resetting driver ride status");
                const driver = await RiderModel.findById(rideData.driver._id).session(session);
                driver.on_ride_id = null;
                driver.isAvailable = true;
                await driver.save({ session });

                // Send notification to driver if user cancelled
                if (cancelBy === 'user' && driver?.fcmToken) {
                    console.log("🔔 Sending notification to driver...");
                    await sendNotification.sendNotification(
                        driver.fcmToken,
                        "Ride Cancelled by User",
                        "The user has cancelled the ride request.",
                        {
                            event: 'RIDE_CANCELLED',
                            rideId: rideData._id,
                            message: 'The user has cancelled the ride request.',
                            screen: 'DriverHome',
                        }
                    );
                }
            }

            await rideData.save({ session });

            // Send notification to user if driver cancelled
            if (cancelBy === 'driver' && rideData?.user?.fcmToken) {
                console.log("🔔 Sending notification to user...");
                await sendNotification.sendNotification(
                    rideData.user.fcmToken,
                    "Ride Cancelled by Driver",
                    "The driver has cancelled your ride.",
                    {
                        event: 'RIDE_CANCELLED',
                        rideId: rideData._id,
                        message: 'The driver has cancelled your ride.',
                        screen: 'RideHistory',
                    }
                );
            }
        });

        return res.status(200).json({
            success: true,
            message: "Ride has been cancelled successfully.",
        });

    } catch (error) {
        console.log("❌ Error cancelling ride:", error.message || error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    } finally {
        await session.endSession();
    }
};


exports.RateYourRider = async (req, res) => {
    try {
        const { rideId } = req.params;
        console.log("📥 Rate Your Rider Request Params:", req.params);
        const { rating, feedback } = req.body;
        console.log("📥 Rate Your Rider Request Body:", req.body);

        // Validate inputs
        if (!rideId || !rating) {
            return res.status(400).json({ message: "Ride ID and rating are required." });
        }

        // Find ride and ensure it's completed
        const rideData = await RideBooking.findById(rideId)
            .populate('user')
            .populate('driver');

        if (!rideData) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (rideData.ride_status !== 'completed') {
            return res.status(400).json({ message: "Ride has not been completed." });
        }

        // Update driver_rating field
        rideData.driver_rating = {
            rating,
            feedback: feedback || '',
            created_at: new Date(),
        };

        await rideData.save();

        return res.status(200).json({
            message: "Rating submitted successfully.",
            data: rideData.driver_rating,
        });
    } catch (error) {
        console.error("❌ Error rating rider:", error);
        return res.status(500).json({ message: "Internal Server Error." });
    }
};
