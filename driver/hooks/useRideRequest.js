
import { useState, useEffect, useRef, useCallback } from "react"
import { Audio } from "expo-av"

const RIDE_REQUEST_TIMEOUT = 120000 // 2 minutes in milliseconds

export default function useRideRequest(socket, riderDetails, navigation) {
  const [rideData, setRideData] = useState(null)
  const [timeLeft, setTimeLeft] = useState(RIDE_REQUEST_TIMEOUT)
  const [sound, setSound] = useState(null)
  const timeoutRef = useRef(null)
  const soundLoopRef = useRef(null)

  const startSound = useCallback(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(require("./sound.mp3"), { shouldPlay: true })
      setSound(sound)
      soundLoopRef.current = sound
    } catch (error) {
      console.error("Error playing sound:", error)
    }
  }, [])

  const stopSound = useCallback(async () => {
    if (soundLoopRef.current) {
      try {
        await soundLoopRef.current.stopAsync()
        await soundLoopRef.current.unloadAsync()
        soundLoopRef.current = null
        setSound(null)
      } catch (error) {
        console.error("Error stopping sound:", error)
      }
    }
  }, [])

  const startTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      handleRejectRide()
    }, RIDE_REQUEST_TIMEOUT)

    const countdownInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1000
      })
    }, 1000)
  }, [])

  const handleRejectRide = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    await stopSound()
    setRideData(null)
    setTimeLeft(RIDE_REQUEST_TIMEOUT)
  }

  const handleAcceptRide = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (socket && rideData) {
      const matchedRider = rideData.riders.find((rider) => rider.name === riderDetails?.name)
      console.log("matchedRider", matchedRider)
      if (matchedRider) {
        socket.emit("ride_accepted", {
          data: {
            rider_id: matchedRider.id,
            ride_request_id: matchedRider.rideRequestId,
            user_id: rideData.user?._id || null,
            rider_name: matchedRider.name,
            vehicleName: matchedRider.vehicleName,
            vehicleNumber: matchedRider.vehicleNumber,
            vehicleType: matchedRider.vehicleType,
            rain: matchedRider?.rain,
            tollPrice: matchedRider?.rain,
            tolls: matchedRider?.tolls,
            price: matchedRider.price,
            eta: matchedRider.eta,
          },
        })
      }
    }
    await stopSound()
    setRideData(null)
    setTimeLeft(RIDE_REQUEST_TIMEOUT)
  }

  const startRideRequest = useCallback(() => {
    if (socket) {
      socket.on("ride_come", (data) => {
        // console.log("Received ride data:", data)
        setRideData(data)
        setTimeLeft(RIDE_REQUEST_TIMEOUT)
        startSound()
        startTimeout()
      })

      socket.on("ride_accepted_message", (data) => {
        const { rideDetails, driver } = data || {}
        if (driver && rideDetails) {
          navigation.navigate("start", {
            screen: "ride_details",
            params: { rideDetails, driver },
            index: 1,
          })


        }
      })
    }
  }, [socket, navigation, startSound, startTimeout, riderDetails])

  const stopRideRequest = useCallback(() => {
    if (socket) {
      socket.off("ride_come")
      socket.off("ride_accepted_message")
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    stopSound()
  }, [socket, stopSound])

  useEffect(() => {
    return () => {
      stopRideRequest()
    }
  }, [stopRideRequest])

  return {
    rideData,
    timeLeft,
    handleAcceptRide,
    handleRejectRide,
    startRideRequest,
    stopRideRequest,
  }
}

