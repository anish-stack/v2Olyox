// backgroundSocketTask.js

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { fetchUserData ,initializeSocket } from "../socketService";

const BACKGROUND_SOCKET_TASK = "background-socket-task";

let lastRunTime = null;

TaskManager.defineTask(BACKGROUND_SOCKET_TASK, async () => {
    try {
        console.log("⚙️ Running background socket task...");

        const user = await fetchUserData();
        if (user?._id) {
            const socket = await initializeSocket({
                userType: "driver",
                userId: user._id,
            });

            console.log("✅ Socket initialized in background");
            // socket.emit("background_ping", { userId: user._id });

            // setTimeout(() => {
            //     // socket.disconnect();
            //     console.log("🔌 Socket disconnected after 10s");
            // }, 10000);
        }

        lastRunTime = Date.now();
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error("❌ Background task error:", error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export async function registerBackgroundSocketTask() {
    const status = await BackgroundFetch.getStatusAsync();
    // console.log("📶 Background fetch status:", status);

    if (
        status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
        status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
        console.warn("🚫 Background fetch unavailable");
        return;
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SOCKET_TASK);
    if (!alreadyRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SOCKET_TASK, {
            minimumInterval: 4, // in seconds
            stopOnTerminate: false,
            startOnBoot: true,
        });
        console.log("✅ Background socket task registered");
    }
}

export async function testBackgroundTaskNow() {
    console.log("⚡️ Manually triggering background task...");

    try {
        const tasks = await TaskManager.getRegisteredTasksAsync();
        console.log("📋 Registered tasks:", JSON.stringify(tasks, null, 2));

        await TaskManager.executeTaskAsync(BACKGROUND_SOCKET_TASK);
    } catch (error) {
        console.error("❌ Manual task execution failed:", error);
    }
}

export function getLastRunTime() {
    return lastRunTime;
}
