const express = require('express');
const http = require('http');
const cors = require('cors');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const axios = require('axios');
require('dotenv').config();

// Database and Models
const connectDb = require('./database/db');
const { connectwebDb } = require('./PaymentWithWebDb/db');
const rideRequestModel = require('./models/ride.request.model');
const RiderModel = require('./models/Rider.model');
const User = require('./models/normal_user/User.model');
const ParcelBoyLocation = require('./models/Parcel_Models/Parcel_Boys_Location');
const Settings = require('./models/Admin/Settings');
const tempRideDetailsSchema = require('./models/tempRideDetailsSchema');

// Routes
const router = require('./routes/routes');
const rides = require('./routes/rides.routes');
const hotelRouter = require('./routes/Hotel.routes');
const users = require('./routes/user_routes/user_routes');
const tiffin = require('./routes/Tiffin/Tiffin.routes');
const parcel = require('./routes/Parcel/Parcel.routes');
const admin = require('./routes/Admin/admin.routes');
const Heavy = require('./routes/Heavy_vehicle/Heavy.routes');
const NewRoutes = require('./routes/New/New.routes');

// Controllers and Middleware
const {
    ChangeRideRequestByRider,
    findRider,
    rideStart,
    rideEnd,
    collectCash,
    AddRating,
    cancelRideByAnyOne,
    cancelRideForOtherDrivers,
    updateRideRejectionStatus,
    findNextAvailableDriver
} = require('./controllers/ride.request');
const {
    update_parcel_request,
    mark_reached,
    mark_pick,
    mark_deliver,
    mark_cancel
} = require('./driver');
const Protect = require('./middleware/Auth');
const sendNotification = require('./utils/sendNotification');

// Initialize Express and Server
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Redis Configuration
const redisOptions = {
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error(`[${new Date().toISOString()}] Redis max retry attempts reached`);
                return new Error('Max retry attempts reached');
            }
            const delay = Math.min(retries * 1000, 5000);
            console.log(`[${new Date().toISOString()}] Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
        }
    },
    password: process.env.REDIS_PASSWORD || undefined
};

// Global Redis client
let pubClient;

// Redis Connection Function
async function connectRedis() {
    try {
        pubClient = createClient(redisOptions);
        
        pubClient.on('error', (err) => {
            console.error(`[${new Date().toISOString()}] Redis client error:`, err.message);
        });
        
        pubClient.on('connect', () => {
            console.log(`[${new Date().toISOString()}] Redis client connecting...`);
        });
        
        pubClient.on('ready', () => {
            console.log(`[${new Date().toISOString()}] Redis client ready`);
        });
        
        pubClient.on('end', () => {
            console.log(`[${new Date().toISOString()}] Redis client connection ended`);
        });
        
        pubClient.on('reconnecting', () => {
            console.log(`[${new Date().toISOString()}] Redis client reconnecting...`);
        });

        await pubClient.connect();
        console.log(`[${new Date().toISOString()}] Redis connected successfully`);
        
        // Make Redis client available to the app
        app.set('pubClient', pubClient);
        
        return pubClient;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Redis connection failed:`, error.message);
        throw error;
    }
}

// Database Connection Functions
async function connectDatabases() {
    try {
        await connectDb();
        console.log(`[${new Date().toISOString()}] Main database connected`);
        
        await connectwebDb();
        console.log(`[${new Date().toISOString()}] Web database connected`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Database connection failed:`, error.message);
        throw error;
    }
}

// Multer for File Uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(cors({ origin: '*', credentials: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware to check Redis connection
app.use((req, res, next) => {
    if (!pubClient || !pubClient.isOpen) {
        console.warn(`[${new Date().toISOString()}] Redis client not available for request: ${req.path}`);
    }
    next();
});
// ia am ams
// Long Polling Updates Endpoint
app.get('/updates/:userId/:userType', async (req, res) => {
    const { userId, userType } = req.params;
    const validTypes = ['user', 'driver', 'tiffin_partner'];
    
    if (!validTypes.includes(userType)) {
        return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    if (!pubClient || !pubClient.isOpen) {
        return res.status(503).json({ success: false, message: 'Redis service unavailable' });
    }

    const timeoutMs = 30000;
    const startTime = Date.now();
    const key = `${userType}:${userId}:updates`;

    try {
        // Register client as active
        await pubClient.set(`active:${userType}:${userId}`, '1', { EX: 3600 });

        while (Date.now() - startTime < timeoutMs) {
            const updates = await pubClient.lPop(key);
            if (updates) {
                const data = JSON.parse(updates);
                return res.json({ success: true, updates: data });
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        res.json({ success: true, updates: null });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Polling error for ${userType}:${userId}:`, err.message);
        res.status(500).json({ success: false, message: 'Polling failed' });
    }
});

// List Available Riders
app.get('/rider', async (req, res) => {
    try {
        const riders = await RiderModel.find({ isAvailable: true });
        res.json({ success: true, riders });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] List riders error:`, err.message);
        res.status(500).json({ success: false, error: 'Failed to list riders' });
    }
});

// Root Endpoint
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Welcome to the API',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Health Check
app.get('/health', async (req, res) => {
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
            redis: {
                connected: pubClient && pubClient.isOpen,
                status: pubClient && pubClient.isOpen ? 'UP' : 'DOWN'
            },
            mongodb: {
                connected: mongoose.connection.readyState === 1,
                status: mongoose.connection.readyState === 1 ? 'UP' : 'DOWN'
            }
        }
    };

    // Test Redis connection
    if (pubClient && pubClient.isOpen) {
        try {
            await pubClient.ping();
            health.services.redis.ping = 'SUCCESS';
        } catch (error) {
            health.services.redis.ping = 'FAILED';
            health.services.redis.error = error.message;
        }
    }

    const allServicesUp = Object.values(health.services).every(service => service.status === 'UP');
    const statusCode = allServicesUp ? 200 : 503;
    
    res.status(statusCode).json(health);
});

// Fetch Current Location
app.post('/Fetch-Current-Location', async (req, res) => {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    }

    const cacheKey = `geocode:${lat},${lng}`;
    
    try {
        // Try to get from cache if Redis is available
        let cachedData = null;
        if (pubClient && pubClient.isOpen) {
            try {
                cachedData = await pubClient.get(cacheKey);
                if (cachedData) {
                    return res.status(200).json({
                        success: true,
                        data: JSON.parse(cachedData),
                        message: 'Location fetched from cache'
                    });
                }
            } catch (cacheError) {
                console.warn(`[${new Date().toISOString()}] Cache read error:`, cacheError.message);
            }
        }

        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCBATa-tKn2Ebm1VbQ5BU8VOqda2nzkoTU'}`
        );
        
        if (!response.data.results?.[0]) {
            return res.status(404).json({ success: false, message: 'No address found' });
        }

        const addressComponents = response.data.results[0].address_components;
        const addressDetails = {
            completeAddress: response.data.results[0].formatted_address,
            city: addressComponents.find(c => c.types.includes('locality'))?.long_name,
            area: addressComponents.find(c => c.types.includes('sublocality_level_1'))?.long_name,
            district: addressComponents.find(c => c.types.includes('administrative_area_level_3'))?.long_name,
            postalCode: addressComponents.find(c => c.types.includes('postal_code'))?.long_name,
            landmark: null,
            lat: response.data.results[0].geometry.location.lat,
            lng: response.data.results[0].geometry.location.lng
        };

        const result = { location: { lat, lng }, address: addressDetails };
        
        // Cache the result if Redis is available
        if (pubClient && pubClient.isOpen) {
            try {
                await pubClient.setEx(cacheKey, 3600, JSON.stringify(result));
            } catch (cacheError) {
                console.warn(`[${new Date().toISOString()}] Cache write error:`, cacheError.message);
            }
        }
        
        res.status(200).json({ success: true, data: result, message: 'Location fetched' });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Location fetch error:`, err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch location' });
    }
});

// Geo-code Distance
app.post('/geo-code-distance', async (req, res) => {
    try {
        const { pickup, dropOff } = req.body;
        
        if (!pickup || !dropOff) {
            return res.status(400).json({ success: false, message: 'Pickup and dropoff addresses required' });
        }

        const cacheKey = `distance:${pickup}:${dropOff}`;
        
        // Try to get from cache if Redis is available
        if (pubClient && pubClient.isOpen) {
            try {
                const cachedData = await pubClient.get(cacheKey);
                if (cachedData) {
                    return res.status(200).json({ success: true, ...JSON.parse(cachedData), fromCache: true });
                }
            } catch (cacheError) {
                console.warn(`[${new Date().toISOString()}] Cache read error:`, cacheError.message);
            }
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCBATa-tKn2Ebm1VbQ5BU8VOqda2nzkoTU';

        const pickupResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address: pickup, key: apiKey }
        });
        
        if (pickupResponse.data.status !== 'OK') {
            return res.status(400).json({ success: false, message: 'Invalid pickup location' });
        }
        const pickupData = pickupResponse.data.results[0].geometry.location;

        const dropOffResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address: dropOff, key: apiKey }
        });
        
        if (dropOffResponse.data.status !== 'OK') {
            return res.status(400).json({ success: false, message: 'Invalid dropoff location' });
        }
        const dropOffData = dropOffResponse.data.results[0].geometry.location;

        const distanceResponse = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
            params: {
                origins: `${pickupData.lat},${pickupData.lng}`,
                destinations: `${dropOffData.lat},${dropOffData.lng}`,
                key: apiKey
            }
        });
        
        if (distanceResponse.data.status !== 'OK' || distanceResponse.data.rows[0].elements[0].status !== 'OK') {
            return res.status(400).json({ success: false, message: 'Failed to calculate distance' });
        }

        const distanceInfo = distanceResponse.data.rows[0].elements[0];
        const settings = await Settings.findOne();
        const distanceInKm = distanceInfo.distance.value / 1000;
        const price = distanceInKm * (settings?.foodDeliveryPrice || 12);

        const result = {
            pickupLocation: pickupData,
            dropOffLocation: dropOffData,
            distance: distanceInfo.distance.text,
            duration: distanceInfo.duration.text,
            price: `₹${price.toFixed(2)}`,
            distanceInKm: distanceInKm.toFixed(2)
        };

        // Cache the result if Redis is available
        if (pubClient && pubClient.isOpen) {
            try {
                await pubClient.setEx(cacheKey, 1800, JSON.stringify(result));
            } catch (cacheError) {
                console.warn(`[${new Date().toISOString()}] Cache write error:`, cacheError.message);
            }
        }
        
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Geo-code distance error:`, err.message);
        res.status(500).json({ success: false, message: 'Failed to calculate distance' });
    }
});

// API Routes
app.use('/api/v1/rider', router);
app.use('/api/v1/rides', rides);
app.use('/api/v1/hotels', hotelRouter);
app.use('/api/v1/user', users);
app.use('/api/v1/tiffin', tiffin);
app.use('/api/v1/parcel', parcel);
app.use('/api/v1/heavy', Heavy);
app.use('/api/v1/admin', admin);
app.use('/api/v1/new', NewRoutes);

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found',
        path: req.originalUrl 
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Server error:`, err.message);
    console.error('Stack:', err.stack);
    
    res.status(err.status || 500).json({ 
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
    console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down gracefully`);
    
    server.close(async () => {
        console.log(`[${new Date().toISOString()}] HTTP server closed`);
        
        // Close Redis connection
        if (pubClient) {
            try {
                await pubClient.quit();
                console.log(`[${new Date().toISOString()}] Redis connection closed`);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error closing Redis:`, error.message);
            }
        }
        
        // Close MongoDB connection
        try {
            await mongoose.connection.close();
            console.log(`[${new Date().toISOString()}] MongoDB connection closed`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error closing MongoDB:`, error.message);
        }
        
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log(`[${new Date().toISOString()}] SIGINT received, shutting down gracefully`);
    process.emit('SIGTERM');
});

// Unhandled Promise Rejection
process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] Unhandled Promise Rejection:`, reason);
    console.error('Promise:', promise);
    // Don't exit the process, just log the error
});

// Uncaught Exception
process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});

// Server Startup Function
async function startServer() {
    const PORT = process.env.PORT || 3100;
    
    try {
        console.log(`[${new Date().toISOString()}] Starting server initialization...`);
        
        // Connect to Redis first
        await connectRedis();
        
        // Connect to databases
        await connectDatabases();
        
        // Start the server
        server.listen(PORT, () => {
            console.log(`[${new Date().toISOString()}] 🚀 Server running on port ${PORT}`);
            console.log(`[${new Date().toISOString()}] 🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`[${new Date().toISOString()}] ✅ All services connected successfully`);
        });
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Failed to start server:`, error.message);
        process.exit(1);
    }
}

// Start the server
startServer();