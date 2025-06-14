const RideBooking = require('./NewRideModel.model');
const axios = require('axios');
const Crypto = require('crypto');
const User = require('../../models/normal_user/User.model');
const RidesSuggestionModel = require('../../models/Admin/RidesSuggestion.model');

exports.NewcreateRequest = async (req, res) => {
    try {
        const user = Array.isArray(req.user.user) ? req.user.user[0] : req.user.user;
        const {
            vehicleType,
            pickupLocation,
            dropLocation,
            currentLocation,
            pick_desc,
            fare,
            drop_desc,
            fcmToken,
            paymentMethod = 'cash',
            platform = 'android',
            scheduledAt = null,
            pickupAddress = {},
            dropAddress = {}
        } = req.body;

        // Validate required fields
        if (!pickupLocation || !dropLocation || !pick_desc || !drop_desc || !currentLocation || !vehicleType) {
            console.warn("Missing required fields in ride request");
            return res.status(400).json({
                error: 'All required fields must be provided',
                required: ['vehicleType', 'pickupLocation', 'dropLocation', 'currentLocation', 'pick_desc', 'drop_desc']
            });
        }

        // Validate fare object if provided
        if (fare && typeof fare !== 'object') {
            return res.status(400).json({
                error: 'Fare must be an object with pricing details'
            });
        }

        // Validate coordinates
        const validateCoordinates = (coords, name) => {
            if (!coords.longitude || !coords.latitude) {
                throw new Error(`Invalid ${name} coordinates`);
            }
            if (coords.longitude < -180 || coords.longitude > 180 ||
                coords.latitude < -90 || coords.latitude > 90) {
                throw new Error(`${name} coordinates out of valid range`);
            }
        };

        validateCoordinates(pickupLocation, 'pickup');
        validateCoordinates(dropLocation, 'drop');
        validateCoordinates(currentLocation, 'current');

        // Validate scheduled time if provided
        if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);
            if (scheduledDate <= new Date()) {
                return res.status(400).json({
                    error: 'Scheduled time must be in the future'
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
            ride_status: { $in: ['pending', 'searching', 'driver_assigned', 'driver_arrived', 'in_progress'] }
        });

        if (existingActiveRide) {
            return res.status(409).json({
                error: 'You already have an active ride request',
                activeRide: existingActiveRide._id
            });
        }

        // Construct geo points using the schema format
        const pickupLocationGeo = {
            type: 'Point',
            coordinates: [pickupLocation.longitude, pickupLocation.latitude]
        };

        const dropLocationGeo = {
            type: 'Point',
            coordinates: [dropLocation.longitude, dropLocation.latitude]
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
                    waypoints: routeData.waypoints || []
                };
            } else {
                // Fallback to calculate straight-line distance
                const straightLineDistance = calculateStraightLineDistance(
                    pickupLocation.latitude, pickupLocation.longitude,
                    dropLocation.latitude, dropLocation.longitude
                );
                routeInfo = {
                    distance: straightLineDistance,
                    duration: Math.round(straightLineDistance * 3), // Rough estimate: 3 minutes per km
                };
            }
        } catch (error) {
            console.warn('Route calculation failed, using fallback:', error.message);
            const straightLineDistance = calculateStraightLineDistance(
                pickupLocation.latitude, pickupLocation.longitude,
                dropLocation.latitude, dropLocation.longitude
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
                currency: fare.currency || 'INR'
            };
        } else {
            pricingData = calculateBasePricing(vehicleType.toLowerCase(), routeInfo.distance || 0);
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
            place_id: pickupAddress.place_id || null
        };

        const dropAddressObj = {
            formatted_address: drop_desc,
            street_number: dropAddress.street_number || null,
            route: dropAddress.route || null,
            locality: dropAddress.locality || null,
            administrative_area: dropAddress.administrative_area || null,
            country: dropAddress.country || null,
            postal_code: dropAddress.postal_code || null,
            place_id: dropAddress.place_id || null
        };

        // Create new ride request with the updated schema
        const newRideRequest = new RideBooking({
            // Location Information
            pickup_location: pickupLocationGeo,
            pickup_address: pickupAddressObj,
            drop_location: dropLocationGeo,
            drop_address: dropAddressObj,

            // Route Information
            route_info: routeInfo,

            // User Information
            user: user,
            user_fcm_token: fcmToken || findUser.fcmToken,

            // Vehicle Information
            vehicle_type: vehicleType.toLowerCase(),

            // Ride Status
            ride_status: 'pending',

            // Timing Information
            requested_at: new Date(),
            scheduled_at: scheduledAt ? new Date(scheduledAt) : null,

            // Pricing Information
            pricing: pricingData,

            // Payment Information
            payment_method: paymentMethod.toLowerCase(),
            payment_status: 'pending',

            // Driver Search Configuration
            search_radius: 5,
            max_search_radius: 25,
            auto_increase_radius: true,
            retry_count: 0,
            rejected_by_drivers: []
        });

        // The schema will auto-generate OTP via pre-save middleware
        // Save the ride request
        await newRideRequest.save();

        // Log successful creation
        console.info(`Ride request created successfully`, {
            rideId: newRideRequest._id,
            userId: user,
            vehicleType,
            status: newRideRequest.ride_status,
            totalFare: newRideRequest.pricing.total_fare,
            distance: routeInfo.distance
        });

        // Start driver search process asynchronously
        setImmediate(() => {
            initiateDriverSearch(newRideRequest._id).catch(error => {
                console.error('Driver search failed:', error.message);
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
            auto_increase_radius: newRideRequest.auto_increase_radius
        };

        res.status(201).json({
            success: true,
            message: 'Ride request created successfully',
            data: responseData
        });

    } catch (error) {
        console.error("Error creating ride request", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.user
        });

        // Handle specific validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'Duplicate entry detected',
                details: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Server error, please try again',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
};

// Helper function to get route information from external API
const getRouteFromAPI = async (pickup, drop) => {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.warn('Google Maps API key not configured');
            return null;
        }

        // Get directions with distance, duration, and polyline
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: `${pickup.latitude},${pickup.longitude}`,
                destination: `${drop.latitude},${drop.longitude}`,
                mode: 'driving',
                units: 'metric',
                key: apiKey
            },
            timeout: 5000 // 5 second timeout
        });

        if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            const leg = route.legs[0];

            return {
                distance: Math.round(leg.distance.value / 1000), // Convert to km
                duration: Math.round(leg.duration.value / 60),   // Convert to minutes
                polyline: route.overview_polyline?.points || null,
                waypoints: [] // Add waypoints if needed
            };
        }
    } catch (error) {
        console.warn('Route API error:', error.message);
    }
    return null;
};

// Helper function to calculate straight-line distance using Haversine formula
const calculateStraightLineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // Round to 2 decimal places
};

// Helper function to calculate base pricing
const calculateBasePricing = (vehicleType, distance) => {
    // Base pricing configuration - adjust according to your business logic
    const pricingConfig = {
        auto: { baseFare: 30, perKm: 12, perMin: 2 },
        bike: { baseFare: 20, perKm: 8, perMin: 1.5 },
        car: { baseFare: 50, perKm: 15, perMin: 3 },
        suv: { baseFare: 80, perKm: 20, perMin: 4 }
    };

    const config = pricingConfig[vehicleType] || pricingConfig.auto;
    const estimatedDuration = Math.round(distance * 3); // 3 minutes per km estimate

    const baseFare = config.baseFare;
    const distanceFare = Math.round(distance * config.perKm);
    const timeFare = Math.round(estimatedDuration * config.perMin);

    // Platform fee (2% of base calculation)
    const subtotal = baseFare + distanceFare + timeFare;
    const platformFee = Math.round(subtotal * 0.02);

    // Night charge (10 PM to 6 AM)
    const currentHour = new Date().getHours();
    const nightCharge = (currentHour >= 22 || currentHour <= 6) ? Math.round(subtotal * 0.1) : 0;

    const totalFare = subtotal + platformFee + nightCharge;

    return {
        base_fare: baseFare,
        distance_fare: distanceFare,
        time_fare: timeFare,
        platform_fee: platformFee,
        night_charge: nightCharge,
        rain_charge: 0, // Can be calculated based on weather API
        toll_charge: 0, // Can be calculated based on route
        discount: 0,
        total_fare: totalFare,
        currency: 'INR'
    };
};


const initiateDriverSearch = async (rideId) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 10000;
    const INITIAL_RADIUS = 2500;
    const RADIUS_INCREMENT = 500;
    const API_TIMEOUT = 8000;
    const MIN_ACTIVE_DRIVERS_THRESHOLD = 1;
    try {
        console.info(`Initiating driver search for ride: ${rideId}`);


        const ride = await RideBooking.findById(rideId);
        if (!ride) {
            throw new Error('Ride not found');
        }

        ride.ride_status = 'searching';
        await ride.save();

        const getDriverSocketMap = () => {
            const driverSocketMap = app.get('driverSocketMap');
            if (!driverSocketMap) {
                logger.warn("driverSocketMap not found in app context", null, context);
                return new Map();
            }
            return driverSocketMap;
        };

        const getPubClient = () => {
            const pubClient = app.get('pubClient');
            if (!pubClient) {
                logger.warn("Redis pubClient not found in app context", null, context);
                return null;
            }
            return pubClient;
        };

        if (['cancelled', 'completed'].includes(RideBooking?.ride_status)) {
            logger.info(`Ride request is ${RideBooking?.ride_status}, stopping search`, null, context);
            return { message: `Ride request is ${status}` };
        }

        // TODO: Implement your driver search logic here
        // This should include:
        // 1. Finding nearby available drivers within search radius
        // 2. Filtering drivers by vehicle type
        // 3. Sorting by distance, rating, or other criteria
        // 4. Sending ride requests to drivers
        // 5. Managing driver responses and timeouts
        // 6. Auto-increasing search radius if no drivers found

        console.info(`Driver search initiated successfully for ride: ${rideId}`);

    } catch (error) {
        console.error('Driver search initiation failed:', error.message);

        // Update ride with error information
        try {
            await RideBooking.findByIdAndUpdate(rideId, {
                $set: {
                    'last_error.message': error.message,
                    'last_error.code': 'DRIVER_SEARCH_FAILED',
                    'last_error.occurred_at': new Date()
                }
            });
        } catch (updateError) {
            console.error('Failed to update ride with error:', updateError.message);
        }
    }
};



exports.ride_status_after_booking = async (req, res) => {
    try {
        console.log("I am")
        const user = Array.isArray(req.user.user) ? req.user.user[0] : req.user.user;
        if (!user) {
            return res.status(401).json({ message: 'Authentication error: User not found.' });
        }
        //  console.log("I user",user)
        const userId = user?._id;
        const { rideId } = req.params;

        if (!rideId) {
            return res.status(400).json({ message: 'Ride ID is required.' });
        }

        // 2. Find the Ride in the Database
        const ride = await RideBooking.findById(rideId).populate('driver'); // Populate driver details

        // 3. Handle Ride Not Found
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found.' });
        }

        // 4. Security Check: Ensure the user requesting status is the one who booked it
        if (ride.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to view this ride.' });
        }

        // 5. Return Response Based on Ride Status (using your new enum)
        let responsePayload = {
            status: ride.ride_status, // Use the correct field name from your schema
            message: '',
            rideDetails: null,
        };

        switch (ride.ride_status) {
            case 'pending':
                responsePayload.message = 'Your ride request is pending confirmation.';
                break;

            case 'searching':
                responsePayload.message = 'Searching for a driver near you...';
                // Frontend should continue polling.
                break;

            case 'driver_assigned':
                responsePayload.message = 'Driver assigned! Your ride is on the way.';
                if (ride.driver) {
                    responsePayload.rideDetails = ride
                } else {

                    responsePayload.message = 'Driver assigned, but details are unavailable. Please wait.';
                    console.warn(`Ride ${ride._id} has status 'driver_assigned' but no driver details populated.`);
                }
                // Frontend should stop polling this endpoint and likely navigate to a driver tracking screen.
                break;

            case 'driver_arrived':
                responsePayload.message = 'Your driver has arrived at the pickup location!';
                if (ride.driver) { // Populate details if needed for UI update
                    responsePayload.rideDetails = ride
                }

                break;

            case 'in_progress':
                responsePayload.message = 'Your ride is currently in progress.';
                if (ride.driver) { // Populate details if needed for UI update
                    responsePayload.rideDetails = {
                        rideId: ride._id,
                        driverId: ride.driver._id,
                        // Potentially live tracking data if you implement that
                    };
                }
                // Frontend might update UI on the tracking screen.
                break;

            case 'completed':
                responsePayload.message = 'Your ride has been completed. Thank you!';
                responsePayload.rideDetails = ride

                break;

            case 'cancelled':
                responsePayload.message = `This ride has been cancelled${ride.cancelledBy ? ` by ${ride.cancelledBy}` : ''}.`;
                responsePayload.rideDetails = ride;
                // Frontend should inform user and potentially go back to booking.
                break;

            default:
                responsePayload.message = 'Ride status is unknown or invalid.';
                console.warn(`Ride ${ride._id} has an unhandled status: ${ride.ride_status}`);
                break;
        }

        return res.status(200).json(responsePayload);

    } catch (error) {
        console.error('Error fetching ride status:', error);
        // Log the specific error for better debugging
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Ride ID format.' });
        }
        return res.status(500).json({ message: 'Server error while fetching ride status.' });
    }
};