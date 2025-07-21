// queues/ProcessRiderQueue.js
const Bull = require('bull');
const Rider = require('../models/Rider.model');
const sendNotification = require('../utils/sendNotification');

// Configuration
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
};

const QUEUE_SETTINGS = {
    lockDuration: 60000, // 1 minute
    stalledInterval: 30000, // 30 seconds
    maxStalledCount: 3,
};

const JOB_OPTIONS = {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
};

// Create queue
const notificationQueue = new Bull('ride-notification-work', {
    redis: REDIS_CONFIG,
    settings: QUEUE_SETTINGS,
    defaultJobOptions: JOB_OPTIONS,
});

// Batch size for processing notifications
const BATCH_SIZE = 100;
const CONCURRENT_NOTIFICATIONS = 10;

// Job data validation
const validateJobData = (data) => {
    const { title, body } = data;

    if (!title || typeof title !== 'string') {
        throw new Error('Title is required and must be a string');
    }

    if (!body || typeof body !== 'string') {
        throw new Error('Body is required and must be a string');
    }

    return true;
};

// Process notifications in batches
const processNotificationBatch = async (riders, title, body, data) => {
    const tokens = riders
        .map(rider => rider.fcmToken)
        .filter(token => token && token.trim() !== '');

    if (tokens.length === 0) {
        return { successes: 0, failures: 0, results: [] };
    }

    // Process notifications concurrently with limit
    const chunks = [];
    for (let i = 0; i < tokens.length; i += CONCURRENT_NOTIFICATIONS) {
        chunks.push(tokens.slice(i, i + CONCURRENT_NOTIFICATIONS));
    }

    const results = [];
    let successes = 0;
    let failures = 0;

    for (const chunk of chunks) {
        const promises = chunk.map(async (token) => {
            try {
                const response = await sendNotification.sendNotification(token, title, body, data || {});
                successes++;
                return { token, status: 'success', response };
            } catch (err) {
                failures++;
                console.error(`Failed to send notification to ${token}:`, err.message);
                return { token, status: 'failed', error: err.message };
            }
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
    }

    return { successes, failures, results };
};

// Main queue processor
notificationQueue.process(async (job) => {
    const { title, body, data, targetType = 'all', targetIds = [] } = job.data;

    try {
        // Validate job data
        validateJobData(job.data);

        // Update job progress
        job.progress(10);

        // Build query based on target type
        let query = { fcmToken: { $exists: true, $ne: null, $ne: '' } };

        if (targetType === 'specific' && targetIds.length > 0) {
            query._id = { $in: targetIds };
        }

        // Get total count for progress tracking
        const totalCount = await Rider.countDocuments(query);

        if (totalCount === 0) {
            console.warn('No riders with registered FCM tokens found');
            return {
                message: 'No riders found with valid FCM tokens',
                total: 0,
                successes: 0,
                failures: 0,
                results: [],
            };
        }

        console.log(`Processing notifications for ${totalCount} riders`);
        job.progress(20);

        let allResults = [];
        let totalSuccesses = 0;
        let totalFailures = 0;
        let processedCount = 0;

        // Process riders in batches
        const cursor = Rider.find(query)
            .select('fcmToken')
            .lean()
            .cursor();

        let batch = [];

        for (let rider = await cursor.next(); rider != null; rider = await cursor.next()) {
            batch.push(rider);

            if (batch.length >= BATCH_SIZE) {
                const batchResult = await processNotificationBatch(batch, title, body, data);

                allResults.push(...batchResult.results);
                totalSuccesses += batchResult.successes;
                totalFailures += batchResult.failures;
                processedCount += batch.length;

                // Update progress
                const progress = Math.min(90, 20 + (processedCount / totalCount) * 70);
                job.progress(progress);

                console.log(`Processed batch: ${processedCount}/${totalCount} riders`);
                batch = [];
            }
        }

        // Process remaining batch
        if (batch.length > 0) {
            const batchResult = await processNotificationBatch(batch, title, body, data);
            allResults.push(...batchResult.results);
            totalSuccesses += batchResult.successes;
            totalFailures += batchResult.failures;
            processedCount += batch.length;
        }

        job.progress(100);

        const result = {
            message: 'Notifications processing completed',
            total: totalCount,
            processed: processedCount,
            successes: totalSuccesses,
            failures: totalFailures,
            successRate: totalCount > 0 ? ((totalSuccesses / totalCount) * 100).toFixed(2) + '%' : '0%',
            results: allResults,
        };

        console.log(`✅ Notification job completed - Success: ${totalSuccesses}, Failed: ${totalFailures}`);
        return result;

    } catch (error) {
        console.error('Error processing notification job:', error);
        throw error; // Let Bull handle the retry logic
    }
});

// Event listeners
notificationQueue.on('completed', (job, result) => {
    console.log(`✅ Notification job ${job.id} completed:`, {
        rideId: job.data.rideId,
        total: result.total,
        successes: result.successes,
        failures: result.failures,
        successRate: result.successRate,
    });
});

notificationQueue.on('failed', (job, err) => {
    console.error(`❌ Notification job ${job.id} failed:`, {
        rideId: job.data.rideId,
        error: err.message,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
    });
});

notificationQueue.on('stalled', (job) => {
    console.warn(`⚠️ Notification job ${job.id} stalled:`, {
        rideId: job.data.rideId,
    });
});

// Helper function to add jobs
const addNotificationJob = async (jobData, options = {}) => {
    try {
        const job = await notificationQueue.add(jobData, {
            ...JOB_OPTIONS,
            ...options,
        });

        console.log(`📧 Notification job ${job.id} added to queue`);
        return job;
    } catch (error) {
        console.error('Failed to add notification job:', error);
        throw error;
    }
};

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('Shutting down notification queue...');
    await notificationQueue.close();
    console.log('Notification queue closed');
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
    queue: notificationQueue,
    addJob: addNotificationJob,
    shutdown: gracefulShutdown,
};