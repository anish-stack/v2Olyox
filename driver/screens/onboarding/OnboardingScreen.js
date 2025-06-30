import { useState, useEffect } from "react"
import { View, StyleSheet, Alert, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import * as Notifications from 'expo-notifications'
import BackButton from "../../components/BackButton"
import OnboardingWelcome from "./OnboardingWelcome"
import RegistrationForm from "./registration/RegistrationForm"
import LoginForm from "./Login/LoginForm"
import OtpScreen from "./OtpScreen"
import NotificationPermissionModal from "./NotificationPermissionModal"
import axios from 'axios'
import { useNavigation } from "@react-navigation/native"

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const OnboardingScreen = () => {
  const [currentScreen, setCurrentScreen] = useState("onboarding")
  const [loginNumber, setLoginNumber] = useState('')
  const [type, setType] = useState('')
  const [registrationStep, setRegistrationStep] = useState(1)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState(null)
  const navigation = useNavigation()

  // Check notification permission status on component mount
  useEffect(() => {
    checkNotificationPermission()
  }, [])

  const checkNotificationPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync()
      setNotificationPermissionStatus(status)

      // Show permission modal if not granted and user hasn't been asked yet
      if (status === 'undetermined') {
        // You can choose when to show this - here it's shown immediately
        // You might want to show it after onboarding completion instead
        setTimeout(() => {
          setShowNotificationModal(true)
        }, 2000) // Show after 2 seconds
      }
    } catch (error) {
      console.error('Error checking notification permissions:', error)
    }
  }

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      })

      setNotificationPermissionStatus(status)
      setShowNotificationModal(false)

      if (status === 'granted') {
        Alert.alert(
          "Notifications Enabled",
          "You'll now receive important updates and reminders!"
        )

        // Get the push token for backend registration
        const token = await Notifications.getExpoPushTokenAsync()
        console.log('Push token:', token.data)

        // Here you can send the token to your backend
        // await registerPushToken(token.data)

      } else if (status === 'denied') {
        Alert.alert(
          "Notifications Disabled",
          "You can enable notifications later in your device settings if you change your mind."
        )
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error)
      Alert.alert("Error", "There was an issue setting up notifications.")
    }
  }

  const handleNotificationPermissionLater = () => {
    setShowNotificationModal(false)
    // You might want to show this again later or after certain actions
  }

  const registerPushToken = async (token) => {
    try {
      // Replace with your backend endpoint
      await axios.post('/api/register-push-token', {
        token: token,
        userId: loginNumber, // or user ID after login
        platform: Platform.OS
      })
    } catch (error) {
      console.error('Error registering push token:', error)
    }
  }

  const handleNextStep = async () => {
    if (validateStep(registrationStep)) {
      if (registrationStep < 2) {
        setRegistrationStep(registrationStep + 1)
      } else {
        await handleSubmit()
      }
    } else {
      Alert.alert("Error", "Please fill in all required fields.")
    }
  }

  const handlePrevStep = () => {
    if (registrationStep > 1) {
      setRegistrationStep(registrationStep - 1)
    } else {
      setCurrentScreen("onboarding")
    }
  }

  const validateStep = (step) => {
    // Add your validation logic here
    return true
  }

  const handleSubmit = async () => {
    // Add your submit logic here
    console.log('Submitting form...')
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#ffd839", "#ffea91"]} style={styles.gradient}>
        {currentScreen !== "onboarding" && <BackButton onPress={handlePrevStep} />}
        <View style={styles.content}>
          {currentScreen === "onboarding" && (
            <OnboardingWelcome
              onRegister={() => navigation.navigate('enter_bh')}
              onComplete={() => navigation.navigate('register')}
              onLogin={() => setCurrentScreen("login")}
            />
          )}

          {currentScreen === "login" && (
            <LoginForm
              onLogin={(number, otpType) => {
                setLoginNumber(number)
                setCurrentScreen("otp")
                setType(otpType)
              }}
            />
          )}

          {currentScreen === "otp" && (
            <OtpScreen
              number={loginNumber}
              type={type}
              onVerify={() => {
                setCurrentScreen("onboarding")
                // Request notification permission after successful login
                if (notificationPermissionStatus === 'undetermined') {
                  setTimeout(() => setShowNotificationModal(true), 1000)
                }
              }}
            />
          )}
        </View>

        {/* Notification Permission Modal */}
        <NotificationPermissionModal
          visible={showNotificationModal}
          onAllow={requestNotificationPermission}
          onLater={handleNotificationPermissionLater}
        />
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
})

export default OnboardingScreen