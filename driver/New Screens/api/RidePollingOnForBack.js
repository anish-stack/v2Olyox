// RideBackgroundService.js
import { useEffect, useState, useRef, useCallback } from "react"
import { AppState } from "react-native"
import * as Notifications from "expo-notifications"
import { Audio } from "expo-av"
import { useFetchUserDetails } from "../../hooks/New Hookes/RiderDetailsHooks";
import { NewRidePooling } from "../utils/NewRidePooling";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Custom hook for ride background service
export const useRideBackgroundService = () => {
  const { userData, loading, error, fetchUserDetails, isOnline } = useFetchUserDetails()
  
  // State management
  const [rides, setRides] = useState([])
  const [currentRide, setCurrentRide] = useState(null)
  const [searching, setSearching] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [statusHistory, setStatusHistory] = useState([])
  const [lastStatusCheck, setLastStatusCheck] = useState(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const [appState, setAppState] = useState(AppState.currentState)
  
  // Refs
  const isMountedRef = useRef(true)
  const intervalRef = useRef(null)
  const soundRef = useRef(null)
  const continuousSoundRef = useRef(null)
  
  // App state handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 App state changed: ${appState} -> ${nextAppState}`)
      setAppState(nextAppState)
    }
    
    const subscription = AppState.addEventListener('change', handleAppStateChange)
    
    return () => {
      subscription?.remove()
    }
  }, [appState])
  
  // Sound management
  const loadNotificationSound = useCallback(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./sound.mp3'), // Add your sound file path
        { shouldPlay: false }
      )
      soundRef.current = sound
      console.log("🔊 Notification sound loaded")
    } catch (error) {
      console.log("❌ Failed to load notification sound:", error)
    }
  }, [])
  
  const playNotificationSound = useCallback(async () => {
    try {
      // Only play sound if app is in background or inactive
      if (appState === 'background' || appState === 'inactive') {
        if (soundRef.current) {
          await soundRef.current.replayAsync()
          console.log("🔊 Notification sound played (app in background)")
        }
      } else {
        console.log("🔇 Skipping sound - app is active")
      }
    } catch (error) {
      console.log("❌ Error playing notification sound:", error)
    }
  }, [appState])
  
  const startContinuousSound = useCallback(async () => {
    try {
      // Only start continuous sound if app is in background
      if (appState === 'background') {
        const { sound } = await Audio.Sound.createAsync(
        require('./sound.mp3'), // Add your sound file path
          { 
            shouldPlay: true,
            isLooping: true,
            volume: 0.8
          }
        )
        continuousSoundRef.current = sound
        console.log("🔊 Continuous sound started (app in background)")
      }
    } catch (error) {
      console.log("❌ Error starting continuous sound:", error)
    }
  }, [appState])
  
  const stopContinuousSound = useCallback(async () => {
    try {
      if (continuousSoundRef.current) {
        await continuousSoundRef.current.stopAsync()
        await continuousSoundRef.current.unloadAsync()
        continuousSoundRef.current = null
        console.log("🔇 Continuous sound stopped")
      }
    } catch (error) {
      console.log("❌ Error stopping continuous sound:", error)
    }
  }, [])
  
  // Enhanced error handling
  const handleError = useCallback((error, context) => {
    const timestamp = new Date().toLocaleTimeString()
    const errorMessage = error?.message || 'Unknown error occurred'
    
    console.log(`❌ Error in ${context}:`, errorMessage)
    
    if (isMountedRef.current) {
      setStatusHistory((prev) => [
        ...prev.slice(-4),
        {
          timestamp,
          status: "error",
          context,
          rideId: null,
          data: { error: errorMessage },
        },
      ])
    }
  }, [])
  
  // Robust ride checking with retry logic
  const checkForRides = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = 2000
    
    console.log("🔍 Checking for new rides...")
    
    if (!isMountedRef.current || isProcessingAction) {
      console.log("⏸️ Skipping ride check - component unmounted or processing")
      return
    }
    
    // Check network connectivity
    if (!isOnline) {
      console.log("📶 No internet connection, skipping ride check")
      return
    }
    
    setIsProcessingAction(true)
    
    try {
      const timestamp = new Date().toLocaleTimeString()
      let sendRider = userData?._id
      
      // Ensure user data is available
      if (!sendRider) {
        console.log("❌ User data not available, fetching...")
        await fetchUserDetails()
        sendRider = userData?._id
        
        if (!sendRider) {
          throw new Error("User data unavailable after fetch attempt")
        }
      }
      
      // Make API call with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      )
      
      const apiPromise = NewRidePooling(sendRider)
      const data = await Promise.race([apiPromise, timeoutPromise])
      
      // console.log("📥 Ride pooling response:", data)
      
      if (data?.length > 0 && data[0]?._id) {
        await handleRideFound(data[0], timestamp)
      } else {
        await handleNoRides(timestamp)
      }
      
    } catch (error) {
      handleError(error, 'checkForRides')
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying ride check (${retryCount + 1}/${MAX_RETRIES})`)
        setTimeout(() => {
          checkForRides(retryCount + 1)
        }, RETRY_DELAY * (retryCount + 1))
      }
    } finally {
      setIsProcessingAction(false)
    }
  }, [userData, isOnline, isProcessingAction, fetchUserDetails, handleError])
  
  // Handle ride found
  const handleRideFound = useCallback(async (ride, timestamp) => {
    if (!isMountedRef.current) return
    
    const rideId = ride._id
    console.log("🎉 Ride found:", rideId)
    
    // Update state
    setRides([ride])
    setCurrentRide(ride)
    setSearching(false)
    setShowModal(true)
    setModalOpen(true)
    
    // Send notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🚖 Ride Found!",
        body: `New ride request from ${ride?.pickupLocation?.address || 'a nearby location'}.`,
        data: { rideId, type: 'ride_found' },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    })
    
    // Update status history
    setStatusHistory((prev) => [
      ...prev.slice(-4),
      {
        timestamp,
        status: "ride_found",
        rideId: rideId.substring(0, 8),
        data: ride,
      },
    ])
    setLastStatusCheck(timestamp)
    
    // Play sounds based on app state
    await playNotificationSound()
    await startContinuousSound()
    
    // Stop ride pooling and start status polling
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    // Start status polling for this ride
    startStatusPolling(rideId)
    
  }, [playNotificationSound, startContinuousSound])
  
  // Handle no rides found
  const handleNoRides = useCallback(async (timestamp) => {
    if (!isMountedRef.current) return
    
    console.log("🔍 No rides found, continuing search...")
    
    setRides([])
    setSearching(true)
    setShowModal(false)
    setModalOpen(false)
    
    // Update status history
    setStatusHistory((prev) => [
      ...prev.slice(-4),
      {
        timestamp,
        status: "no_rides",
        rideId: null,
        data: null,
      },
    ])
    setLastStatusCheck(timestamp)
  }, [])
  
  // Status polling for active rides
  const startStatusPolling = useCallback((rideId) => {
    console.log("🔄 Starting status polling for ride:", rideId)
    
    const pollInterval = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(pollInterval)
        return
      }
      
      try {
        // Add your ride status checking API call here
        // const status = await checkRideStatus(rideId)
        console.log("📊 Polling ride status...")
      } catch (error) {
        handleError(error, 'statusPolling')
      }
    }, 5000) // Poll every 5 seconds
    
    intervalRef.current = pollInterval
  }, [handleError])
  
  // Main background service function
  const startRideBackgroundService = useCallback(() => {
    console.log("🚀 Starting ride background service...")
    
    if (intervalRef.current) {
      console.log("⚠️ Service already running")
      return
    }
    
    // Initial check
    checkForRides()
    
    // Set up interval for continuous checking
    intervalRef.current = setInterval(() => {
      checkForRides()
    }, 30000) // Check every 30 seconds
    
    console.log("✅ Ride background service started")
  }, [checkForRides])
  
  const stopRideBackgroundService = useCallback(() => {
    console.log("🛑 Stopping ride background service...")
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    stopContinuousSound()
    console.log("✅ Ride background service stopped")
  }, [stopContinuousSound])
  
  // Initialize service
  useEffect(() => {
    fetchUserDetails()
    loadNotificationSound()
    
    return () => {
      isMountedRef.current = false
      stopRideBackgroundService()
    }
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync()
      }
      stopContinuousSound()
    }
  }, [stopContinuousSound])
  
  return {
    // State
    rides,
    currentRide,
    searching,
    showModal,
    modalOpen,
    statusHistory,
    lastStatusCheck,
    isProcessingAction,
    appState,
    loading,
    error,
    isOnline,
    
    // Actions
    startRideBackgroundService,
    stopRideBackgroundService,
    checkForRides,
    stopContinuousSound,
    
    // Setters (if needed by parent components)
    setShowModal,
    setModalOpen,
    setCurrentRide,
  }
}