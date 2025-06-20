import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import Input from "../../components/Input";
import Button from "../../components/Button";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { initializeSocket } from "../../context/socketService";
import { Ionicons } from '@expo/vector-icons';

const OtpScreen = ({ onVerify, number, type }) => {
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigation = useNavigation();
  
  // Animation references
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    let interval;
    if (isResendDisabled && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [isResendDisabled, timer]);

  const initializeConnection = async (maxRetries = 4, retryDelay = 2000, userId) => {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const data = await initializeSocket({
          userType: 'driver',
          userId: userId
        });

        if (data?.connected) {
          console.log('Socket connected successfully:', data);
          return true;
        }
      } catch (error) {
        console.error(`Socket connection failed (Attempt ${attempts + 1}):`, error);
      }

      attempts++;
      if (attempts < maxRetries) {
        console.log(`Retrying socket connection... (${attempts}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    console.log("All socket connection attempts failed");
    return false;
  };

  const handleOtpChange = (text) => {
    // Clear error messages when user types
    if (errorMessage) setErrorMessage("");
    
    // Only accept numbers and limit to 6 digits
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue.length <= 6) {
      setOtp(numericValue);
    }
  };

  const validateOtp = () => {
    if (!otp) {
      setErrorMessage("Please enter the OTP");
      startShakeAnimation();
      return false;
    }
    
    if (otp.length !== 6) {
      setErrorMessage("OTP must be 6 digits");
      startShakeAnimation();
      return false;
    }
    
    return true;
  };

  const startShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { 
        toValue: 10, 
        duration: 50, 
        useNativeDriver: true 
      }),
      Animated.timing(shakeAnimation, { 
        toValue: -10, 
        duration: 50, 
        useNativeDriver: true 
      }),
      Animated.timing(shakeAnimation, { 
        toValue: 10, 
        duration: 50, 
        useNativeDriver: true 
      }),
      Animated.timing(shakeAnimation, { 
        toValue: 0, 
        duration: 50, 
        useNativeDriver: true 
      })
    ]).start();
  };

  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    Animated.sequence([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.delay(2000),
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => setSuccessMessage(""));
  };

  const handleOtpVerify = async () => {
    Keyboard.dismiss();
    
    // Validate OTP
    if (!validateOtp()) return;

    setIsVerifying(true);
    setErrorMessage("");
    
    try {
      const response = await axios.post(
        'http://192.168.1.6:3100/api/v1/rider/rider-verify',
        { 
          otp, 
          number,
          otpType: type // Send OTP type in the request body
        }
      );
      
      if (response.data.success) {
        const token = response.data.token;
        const accountStatus = response.data.accountStatus;
        const isDocumentUpload = response.data.isDocumentUpload;
        const DocumentVerify = response.data.DocumentVerify;

        await SecureStore.setItemAsync('auth_token_cab', token);
        showSuccessMessage("OTP verified successfully!");

        // Navigation Logic with delays for better UX
        setTimeout(async () => {
          setIsVerifying(false);
          
          if (!accountStatus) {
            navigation.navigate('UploadDocuments');
          } else if (!isDocumentUpload) {
            navigation.navigate('UploadDocuments');
          } else if (!DocumentVerify) {
            navigation.navigate('Wait_Screen');
          } else {
         
            navigation.navigate('Home');
          }

          onVerify();
        }, 1000);
      } else {
        setIsVerifying(false);
        setErrorMessage(response.data.message || "Verification failed");
        console.log("OTP verification failed:", response.data.message);
        
        Alert.alert(
          "Verification Failed", 
          response.data.message || "Please check the OTP and try again",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      setIsVerifying(false);
      const errorMsg = error?.response?.data?.message || "Something went wrong";
      setErrorMessage(errorMsg);
      
      Alert.alert(
        'Verification Error', 
        errorMsg,
        [{ text: "OK" }]
      );
      console.error("Error during OTP verification:", error);
    }
  };

  const handleResendOtp = async () => {
    if (isResendDisabled) return;
    
    Keyboard.dismiss();
    setErrorMessage("");
    setIsResendDisabled(true);
    
    try {
      const response = await axios.post(
        'http://192.168.1.6:3100/api/v1/rider/rider-login',
        { 
          number,
          otpType: type // Send OTP type in request body
        }
      );
      
      if (response.data.success) {
        setTimer(30); 
        showSuccessMessage("OTP resent successfully!");
        console.log("OTP resent:", response.data);
      } else {
        setIsResendDisabled(false);
        setErrorMessage(response.data.message || "Failed to resend OTP");
        console.log("Failed to resend OTP:", response.data.message);
        
        Alert.alert(
          "Resend Failed", 
          response.data.message || "Failed to resend OTP. Please try again.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      setIsResendDisabled(false);
      const errorMsg = error?.response?.data?.message || "Something went wrong";
      setErrorMessage(errorMsg);
      
      Alert.alert(
        'Resend Error', 
        errorMsg,
        [{ text: "OK" }]
      );
      console.error("Error during OTP resend:", error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <Ionicons name="shield-checkmark" size={60} color="#e51e25" />
          <Text style={styles.title}>Verification</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit OTP to your{' '}
            <Text style={styles.highlightText}>
              {type === 'whatsapp' ? 'WhatsApp' : 'SMS'}{' '}
            </Text>
            on{' '}
            <Text style={styles.highlightText}>{number}</Text>
          </Text>
        </View>

        <Animated.View 
          style={[
            styles.inputContainer,
            { transform: [{ translateX: shakeAnimation }] }
          ]}
        >
          <Input
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="numeric"
            icon="lock"
            style={[styles.input, errorMessage ? styles.inputError : null]}
            maxLength={6}
          />
          
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={16} color="#e51e25" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
          
          <Animated.View style={[styles.successContainer, { opacity: successOpacity }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
            <Text style={styles.successText}>{successMessage}</Text>
          </Animated.View>
        </Animated.View>

        {isVerifying ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e51e25" />
            <Text style={styles.loadingText}>Verifying OTP...</Text>
          </View>
        ) : (
          <Button 
            title="Verify & Proceed" 
            onPress={handleOtpVerify} 
            style={styles.verifyButton} 
            textStyle={styles.buttonText}
          />
        )}

        <View style={styles.resendContainer}>
          <Text style={styles.timerText}>
            {isResendDisabled 
              ? `Resend available in ${timer}s` 
              : "Didn't receive the OTP?"
            }
          </Text>
          <TouchableOpacity
            onPress={handleResendOtp}
            disabled={isResendDisabled || isVerifying}
            style={[
              styles.resendButton, 
              (isResendDisabled || isVerifying) && styles.disabledButton
            ]}
          >
            <Text style={[
              styles.resendButtonText,
              (isResendDisabled || isVerifying) && styles.disabledButtonText
            ]}>
              Resend OTP
            </Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.otpMethod}>
          OTP sent via: {type === 'whatsapp' ? 'WhatsApp' : 'SMS Text'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333333",
    marginTop: 15,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
    marginHorizontal: 20,
  },
  highlightText: {
    fontWeight: "bold",
    color: "#333333",
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    borderColor: "#e0e0e0",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 5,
    textAlign: "center",
  },
  inputError: {
    borderColor: "#e51e25",
    borderWidth: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 5,
  },
  errorText: {
    color: "#e51e25",
    fontSize: 14,
    marginLeft: 5,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 5,
  },
  successText: {
    color: "#4CAF50",
    fontSize: 14,
    marginLeft: 5,
  },
  verifyButton: {
    marginTop: 10,
    backgroundColor: "#e51e25",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  resendContainer: {
    marginTop: 25,
    alignItems: "center",
  },
  timerText: {
    fontSize: 15,
    color: "#666666",
    marginBottom: 10,
  },
  resendButton: {
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e51e25",
  },
  disabledButton: {
    borderColor: "#cccccc",
  },
  resendButtonText: {
    fontSize: 16,
    color: "#e51e25",
    fontWeight: "500",
  },
  disabledButtonText: {
    color: "#cccccc",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    width: "100%",
    paddingVertical: 15,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#e51e25",
  },
  otpMethod: {
    position: "absolute",
    bottom: 20,
    color: "#999999",
    fontSize: 14,
  }
});

export default OtpScreen;