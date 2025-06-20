import { useEffect, useState, useCallback } from "react"
import * as SecureStore from "expo-secure-store"
import axios from "axios"
import { Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
const API_URL = "http://192.168.1.6:3100/api/v1"
const RIDER_API = `${API_URL}/rider`
const useUserDetails = () => {
  const [userData, setUserData] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  const [loading, setLoading] = useState(true)

  const navigation = useNavigation()

  const fetchUserDetails = useCallback(async () => {
    setLoading(true)
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab")

      if (!token) {
        throw new Error("Authentication token not found")
      }

      const response = await axios.get(`${RIDER_API}/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.data.success && response.data.partner) {
        const partnerData = response.data.partner
        setUserData(partnerData)
        setIsOnline(partnerData.isAvailable)

        // Initialize socket connection with user ID
        // await initializeSocket({ userId: partnerData._id })

        return partnerData
      } else {
        throw new Error(response.data.message || "Failed to fetch user details")
      }
    } catch (error) {
      console.error("Error fetching user details:", error?.response?.data?.message || error.message)

      if (error?.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Onboarding" }],
                })
              }
            }
          ]
        )
      }
    } finally {
      setLoading(false)
    }
  }, [navigation])

  useEffect(() => {
    fetchUserDetails()
  }, [fetchUserDetails])

  return {
    userData,
    isOnline,
    loading,
    refetchUserDetails: fetchUserDetails
  }
}

export default useUserDetails
