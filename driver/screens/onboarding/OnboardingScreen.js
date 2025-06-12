import { useState } from "react"
import { View, StyleSheet, Alert, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import BackButton from "../../components/BackButton"
import OnboardingWelcome from "./OnboardingWelcome"
import RegistrationForm from "./registration/RegistrationForm"
import LoginForm from "./Login/LoginForm"
import OtpScreen from "./OtpScreen"
import axios from 'axios'
import { useNavigation } from "@react-navigation/native"
const OnboardingScreen = () => {
  const [currentScreen, setCurrentScreen] = useState("onboarding")
  const [loginNumber, setLoginNumber] = useState('')
  const [type, setType] = useState('')
  const [registrationStep, setRegistrationStep] = useState(1)
  const navigation = useNavigation()


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

          {currentScreen === "login" && <LoginForm onLogin={(number, otpType) => {
            setLoginNumber(number)
            setCurrentScreen("otp")
            setType(otpType)
          }} />}
          {currentScreen === "otp" && <OtpScreen number={loginNumber} type={type} onVerify={() => setCurrentScreen("onboarding")} />}
        </View>
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
