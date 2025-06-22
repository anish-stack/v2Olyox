// BackgroundLogger.js
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const TASK_NAME = 'BACKGROUND_LOGGER_TASK';

// 🧠 Define the task logic
TaskManager.defineTask(TASK_NAME, async () => {
    try {
        const now = new Date();
        console.log(`🕒 Background log: ${now.toLocaleTimeString()}`);

        // Example: You could hit an API here
        // await fetch('https://your-api.com/log', { method: 'POST' });

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('❌ Background task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export async function registerBackgroundLogger() {
    const status = await BackgroundFetch.getStatusAsync();
    console.log('📋 Background fetch status:', status);

    if (status === BackgroundFetch.Status.Restricted || status === BackgroundFetch.Status.Denied) {
        console.log('⛔ Background fetch not available');
        return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
            minimumInterval: 60, // ⏱️ minimum interval in seconds
            stopOnTerminate: false,
            startOnBoot: true,
        });
        console.log('✅ Background logger task registered');
    } else {
        console.log('⚠️ Background logger already registered');
    }
}

export async function unregisterBackgroundLogger() {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
        console.log('🚫 Background logger task unregistered');
    }
}
