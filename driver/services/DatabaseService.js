import AsyncStorage from "@react-native-async-storage/async-storage"

const RIDE_STORAGE_KEY = "active_ride"
const RIDE_STATE_KEY = "ride_state"

export const LocalRideStorage = {
  async saveRide(rideData) {
    try {
      if (!rideData || !rideData._id) throw new Error("Ride must have an _id")


      await AsyncStorage.setItem(RIDE_STORAGE_KEY, JSON.stringify(rideData))
      console.log("✅ Ride saved to storage")
    } catch (error) {
      console.error("❌ Error saving ride:", error)
    }
  },

  async getRide() {
    try {
      const rideString = await AsyncStorage.getItem(RIDE_STORAGE_KEY)
      if (rideString) {
        const rideData = JSON.parse(rideString)
        console.log("📦 Retrieved ride from storage:", rideData)
        return rideData
      }
      return null
    } catch (error) {
      console.error("❌ Error getting ride:", error)
      return null
    }
  },

  async clearRide() {
    try {
      await AsyncStorage.removeItem(RIDE_STORAGE_KEY)
      await AsyncStorage.removeItem(RIDE_STATE_KEY)
      console.log("🗑 Ride data cleared")
    } catch (error) {
      console.error("❌ Error clearing ride:", error)
    }
  },

  async saveRideState(stateData) {
    try {
      const stateToSave = {
        otp: stateData.otp || "",
        rideStarted: stateData.rideStarted || false,
        rideCompleted: stateData.rideCompleted || false,
      }

      // Clear any existing ride state first
      await AsyncStorage.removeItem(RIDE_STATE_KEY)

      await AsyncStorage.setItem(RIDE_STATE_KEY, JSON.stringify(stateToSave))
      console.log("✅ Ride state saved to storage:", stateToSave)
    } catch (error) {
      console.error("❌ Error saving ride state:", error)
    }
  },

  async getRideState() {
    try {
      const stateString = await AsyncStorage.getItem(RIDE_STATE_KEY)
      if (stateString) {
        const stateData = JSON.parse(stateString)
        console.log("📦 Retrieved ride state from storage:", stateData)
        return stateData
      }
      return {
        otp: "",
        rideStarted: false,
        rideCompleted: false,
      }
    } catch (error) {
      console.error("❌ Error getting ride state:", error)
      return {
        otp: "",
        rideStarted: false,
        rideCompleted: false,
      }
    }
  },
}
