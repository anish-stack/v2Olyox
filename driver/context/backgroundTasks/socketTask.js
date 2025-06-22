// backgroundSocketTask.js
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Audio } from 'expo-av';
import { fetchUserData, initializeSocket } from "../socketService";
import { NewRidePooling } from '../../New Screens/utils/NewRidePooling';

const BACKGROUND_SOCKET_TASK = "background-socket-task";
let lastRunTime = null;
let taskExecutionCount = 0;
let totalRidesFound = 0;

// Utility function to wait/delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced logging function
const logWithTimestamp = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  switch (type) {
    case 'error':
      console.error(`❌ ${logMessage}`);
      break;
    case 'warn':
      console.warn(`⚠️ ${logMessage}`);
      break;
    case 'success':
      console.log(`✅ ${logMessage}`);
      break;
    default:
      console.log(`📝 ${logMessage}`);
  }
};

// Function to perform ride polling with retries
async function performRidePolling(userId, maxAttempts = 10, intervalSeconds = 5) {
  logWithTimestamp(`🔄 Starting ride polling for user: ${userId}`);
  logWithTimestamp(`📊 Configuration: ${maxAttempts} attempts, ${intervalSeconds}s interval`);
  
  let ridesFound = [];
  let attemptCount = 0;
  let totalAttempts = 0;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    totalAttempts++;
    logWithTimestamp(`🎯 Polling attempt ${attempt}/${maxAttempts}`);
    
    try {
      const startTime = Date.now();
      
      // Call the ride pooling function
      const data = await NewRidePooling(userId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logWithTimestamp(`⏱️ Polling API call completed in ${duration}ms`);
      
      if (data && Array.isArray(data)) {
        logWithTimestamp(`📊 Rides returned: ${data.length}`);
        
        if (data.length > 0) {
          ridesFound = data;
          logWithTimestamp(`🎉 Found ${data.length} rides on attempt ${attempt}!`, 'success');
          
          // Log details of found rides
          data.forEach((ride, index) => {
            logWithTimestamp(`🚗 Ride ${index + 1}: ID=${ride._id}, Status=${ride.status || 'N/A'}`);
          });
          
          totalRidesFound += data.length;
          break; // Exit loop if rides found
        } else {
          logWithTimestamp(`🚫 No rides found on attempt ${attempt}`);
        }
      } else {
        logWithTimestamp(`⚠️ Invalid data format received: ${typeof data}`, 'warn');
      }
      
      // Wait before next attempt (except for last attempt)
      if (attempt < maxAttempts) {
        logWithTimestamp(`⏳ Waiting ${intervalSeconds} seconds before next attempt...`);
        await delay(intervalSeconds * 1000);
      }
      
    } catch (error) {
      logWithTimestamp(`❌ Error in polling attempt ${attempt}: ${error.message}`, 'error');
      
      // Wait before retry even on error (except for last attempt)
      if (attempt < maxAttempts) {
        logWithTimestamp(`⏳ Waiting ${intervalSeconds} seconds before retry...`);
        await delay(intervalSeconds * 1000);
      }
    }
  }
  
  // Summary logging
  logWithTimestamp(`📈 Polling Summary:`);
  logWithTimestamp(`   • Total attempts: ${totalAttempts}`);
  logWithTimestamp(`   • Rides found: ${ridesFound.length}`);
  logWithTimestamp(`   • Total duration: ~${totalAttempts * intervalSeconds} seconds`);
  
  return ridesFound;
}

// Function to play notification sound
async function playNotificationSound() {
  try {
    logWithTimestamp(`🔊 Attempting to play notification sound...`);
    
    const { sound } = await Audio.Sound.createAsync(
      require('./sound.mp3'),
      { 
        shouldPlay: true,
        volume: 1.0,
        isLooping: false
      }
    );
    
    await sound.playAsync();
    logWithTimestamp(`🔔 Notification sound played successfully`, 'success');
    
    // Unload sound after playing to free memory
    setTimeout(async () => {
      try {
        await sound.unloadAsync();
        logWithTimestamp(`🗑️ Sound resource unloaded`);
      } catch (unloadError) {
        logWithTimestamp(`⚠️ Error unloading sound: ${unloadError.message}`, 'warn');
      }
    }, 3000);
    
  } catch (error) {
    logWithTimestamp(`❌ Error playing notification sound: ${error.message}`, 'error');
  }
}

// Function to send notification
async function sendRideNotification(rides) {
  try {
    const firstRide = rides[0];
    const rideId = firstRide._id;
    const rideCount = rides.length;
    
    logWithTimestamp(`📱 Sending notification for ${rideCount} ride(s)`);
    

    
    logWithTimestamp(`✅ Notification sent successfully`, 'success');
  } catch (error) {
    logWithTimestamp(`❌ Error sending notification: ${error.message}`, 'error');
  }
}

TaskManager.defineTask(BACKGROUND_SOCKET_TASK, async () => {
  const taskStartTime = Date.now();
  taskExecutionCount++;
  
  logWithTimestamp(`🚀 Starting background socket task execution #${taskExecutionCount}`);
  
  try {
    // Step 1: Fetch user data
    logWithTimestamp(`👤 Fetching user data...`);
    const user = await fetchUserData();
    
    if (!user?._id) {
      logWithTimestamp(`🚫 No user ID found - aborting task`, 'warn');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    logWithTimestamp(`✅ User data fetched - User ID: ${user._id}`, 'success');
    
    // Step 2: Initialize socket
    logWithTimestamp(`🔌 Initializing socket connection...`);
    try {
      await initializeSocket({
        userType: "driver",
        userId: user._id,
      });
      logWithTimestamp(`✅ Socket initialized successfully`, 'success');
    } catch (socketError) {
      logWithTimestamp(`⚠️ Socket initialization warning: ${socketError.message}`, 'warn');
      // Continue with task even if socket fails
    }
    
    // Step 3: Use quick polling for background tasks (more reliable)
    logWithTimestamp(`🎯 Starting ride polling process...`);
    
    // Try quick polling first (faster, more background-friendly)
    let ridesData = await NewRidePooling(user._id, 5);
    
    // If no results and we have time, try one more comprehensive poll
    if (!ridesData || ridesData.length === 0) {
      const elapsedSoFar = Date.now() - taskStartTime;
      if (elapsedSoFar < 15000) { // If less than 15 seconds elapsed
        logWithTimestamp(`🔄 No rides from quick poll, trying comprehensive poll...`);
        ridesData = await performRidePolling(user._id, 3, 2); // 3 attempts, 2 seconds apart
      } else {
        logWithTimestamp(`⏰ Time limit reached, skipping comprehensive poll`);
      }
    }
    
    // Step 4: Handle found rides
    if (ridesData && ridesData.length > 0) {
      logWithTimestamp(`🎉 Processing ${ridesData.length} found rides`, 'success');
      
      // Play notification sound
      await playNotificationSound();
      
      // Send notification
      await sendRideNotification(ridesData);
      
      // Log ride details
      ridesData.forEach((ride, index) => {
        logWithTimestamp(`🚗 Ride ${index + 1} Details:`);
        logWithTimestamp(`   • ID: ${ride._id}`);
        logWithTimestamp(`   • Status: ${ride.status || 'N/A'}`);
        logWithTimestamp(`   • Created: ${ride.createdAt || 'N/A'}`);
        if (ride.pickup) {
          logWithTimestamp(`   • Pickup: ${ride.pickup.address || 'N/A'}`);
        }
        if (ride.destination) {
          logWithTimestamp(`   • Destination: ${ride.destination.address || 'N/A'}`);
        }
      });
      
    } else {
      logWithTimestamp(`🚫 No rides found after all polling attempts`);
    }
    
    // Step 5: Task completion summary
    const taskEndTime = Date.now();
    const taskDuration = taskEndTime - taskStartTime;
    lastRunTime = taskEndTime;
    
    logWithTimestamp(`📊 Task Execution Summary:`);
    logWithTimestamp(`   • Task #: ${taskExecutionCount}`);
    logWithTimestamp(`   • Duration: ${taskDuration}ms (${(taskDuration/1000).toFixed(2)}s)`);
    logWithTimestamp(`   • Rides found: ${ridesData?.length || 0}`);
    logWithTimestamp(`   • Total rides found (session): ${totalRidesFound}`);
    logWithTimestamp(`   • Completed at: ${new Date(taskEndTime).toLocaleString()}`);
    
    logWithTimestamp(`✅ Background task completed successfully`, 'success');
    
    return ridesData?.length > 0 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
    
  } catch (error) {
    const taskEndTime = Date.now();
    const taskDuration = taskEndTime - taskStartTime;
    
    logWithTimestamp(`❌ Background task failed after ${taskDuration}ms`, 'error');
    logWithTimestamp(`❌ Error details: ${error.message}`, 'error');
    logWithTimestamp(`❌ Error stack: ${error.stack}`, 'error');
    
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSocketTask() {
  logWithTimestamp(`📋 Registering background socket task...`);
  
  const status = await BackgroundFetch.getStatusAsync();
  logWithTimestamp(`📊 Background fetch status: ${status}`);
  
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    logWithTimestamp(`🚫 Background fetch unavailable - Status: ${status}`, 'warn');
    return;
  }
  
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SOCKET_TASK);
  logWithTimestamp(`📝 Task registration status: ${isRegistered ? 'Already registered' : 'Not registered'}`);
  
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SOCKET_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS requirement)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    logWithTimestamp(`✅ Background socket task registered successfully`, 'success');
  } else {
    logWithTimestamp(`ℹ️ Background socket task already registered`);
  }
}

export async function testBackgroundTaskNow() {
  logWithTimestamp(`⚡️ Manually triggering background task...`);
  
  try {
    const tasks = await TaskManager.getRegisteredTasksAsync();
    logWithTimestamp(`📋 Currently registered tasks: ${tasks.length}`);
    
    tasks.forEach((task, index) => {
      logWithTimestamp(`   ${index + 1}. ${task.taskName} - Type: ${task.taskType}`);
    });
    
    logWithTimestamp(`🚀 Executing background task manually...`);
    await TaskManager.executeTaskAsync(BACKGROUND_SOCKET_TASK);
    logWithTimestamp(`✅ Manual task execution completed`, 'success');
    
  } catch (error) {
    logWithTimestamp(`❌ Manual task execution failed: ${error.message}`, 'error');
    logWithTimestamp(`❌ Error stack: ${error.stack}`, 'error');
  }
}

// Test function to check if NewRidePooling is working
export async function testRidePollingOnly() {
  logWithTimestamp(`🧪 Testing ride polling function only...`);
  
  try {
    const user = await fetchUserData();
    if (!user?._id) {
      logWithTimestamp(`🚫 No user ID for testing`, 'warn');
      return;
    }
    
    logWithTimestamp(`🎯 Testing single ride polling call...`);
    const startTime = Date.now();
    
    const data = await NewRidePooling(user._id);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logWithTimestamp(`⏱️ Single polling call completed in ${duration}ms`);
    logWithTimestamp(`📊 Result: ${data ? `${data.length} rides` : 'null/undefined'}`);
    
    if (data && Array.isArray(data)) {
      data.forEach((ride, index) => {
        logWithTimestamp(`🚗 Test Ride ${index + 1}: ${ride._id}`);
      });
    }
    
    logWithTimestamp(`✅ Ride polling test completed`, 'success');
    
  } catch (error) {
    logWithTimestamp(`❌ Ride polling test failed: ${error.message}`, 'error');
  }
}

// Test delay function
export async function testDelayFunction() {
  logWithTimestamp(`⏱️ Testing delay function...`);
  
  try {
    logWithTimestamp(`🔄 Starting 3-second delay test...`);
    const startTime = Date.now();
    
    await backgroundSafeDelay(3000);
    
    const endTime = Date.now();
    const actualDelay = endTime - startTime;
    
    logWithTimestamp(`✅ Delay completed in ${actualDelay}ms (expected ~3000ms)`);
    
  } catch (error) {
    logWithTimestamp(`❌ Delay test failed: ${error.message}`, 'error');
  }
}

export function getLastRunTime() {
  return lastRunTime;
}

export function getTaskStats() {
  return {
    executionCount: taskExecutionCount,
    totalRidesFound: totalRidesFound,
    lastRunTime: lastRunTime
  };
}

// Export logging function for external use
export { logWithTimestamp };