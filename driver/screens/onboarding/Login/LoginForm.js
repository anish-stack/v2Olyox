import { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  TouchableOpacity,
  Image
} from "react-native";
import Input from "../../../components/Input";
import Button from "../../../components/Button";
import axios from 'axios';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons'; // Make sure to install expo vector icons if not already

const LoginForm = ({ onLogin }) => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpType, setOtpType] = useState("text"); // "text" or "whatsapp"
  const navigation = useNavigation();

  const validateAndFormatPhone = (number) => {
    // Remove all non-numeric characters including +91
    const cleanNumber = number.replace(/\D/g, '');
    
    // If number starts with 91, remove it
    const formattedNumber = cleanNumber.startsWith('91') 
      ? cleanNumber.substring(2) 
      : cleanNumber;
    
    // Check if it's exactly 10 digits
    if (formattedNumber.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return null;
    }
    
    setError("");
    return formattedNumber;
  };

  const handlePhoneChange = (text) => {
    setPhone(text);
    if (error) setError("");
  };

  const handleLogin = async () => {
    const formattedPhone = validateAndFormatPhone(phone);
    if (!formattedPhone) return;
    
    setLoading(true);
    
    try {
      const response = await axios.post(
        'https://appapi.olyox.com/api/v1/rider/rider-login', 
        { 
          number: formattedPhone,
          otpType: otpType // Add otpType to the request body
        }
      );
      
      if (response.data.success) {
        console.log("Login successful", response.data);
        onLogin(formattedPhone ,otpType);
      } else {
        setError(response.data.message || "Login failed");
        console.log("Login failed", response.data.message);
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        Alert.alert(
          'Complete Profile', 
          error?.response?.data?.message, 
          [{
            text: 'OK',
            onPress: () => navigation.navigate('register')
          }]
        );
      } else if (error?.response?.status === 402) {
        Alert.alert(
          'Profile Not Found', 
          error?.response?.data?.message, 
          [{
            text: 'OK',
            onPress: () => navigation.navigate('enter_bh')
          }]
        );
      } else {
        setError(error?.response?.data?.message || "Something went wrong");
        Alert.alert(
          'Error', 
          error?.response?.data?.message || "Something went wrong"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image 
          source={require('./icon_.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Login with your phone number</Text>
      
      <View style={styles.formContainer}>
        <Input
          placeholder="Enter 10-digit Phone Number"
          value={phone}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          icon="phone"
          style={styles.input}
          maxLength={15} // Allow for country code entry that will be trimmed
        />
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <Text style={styles.otpSectionTitle}>Select OTP Method</Text>
        
        <View style={styles.optTypeContainer}>
          <TouchableOpacity
            style={[
              styles.otpTypeButton,
              otpType === "text" && styles.otpTypeButtonActive
            ]}
            onPress={() => setOtpType("text")}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={22} 
              color={otpType === "text" ? "#ffffff" : "#666666"} 
            />
            <Text
              style={[
                styles.otpTypeText,
                otpType === "text" && styles.otpTypeTextActive
              ]}
            >
              SMS Text
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.otpTypeButton,
              otpType === "whatsapp" && styles.otpTypeButtonActive
            ]}
            onPress={() => setOtpType("whatsapp")}
          >
            <Ionicons 
              name="logo-whatsapp" 
              size={22} 
              color={otpType === "whatsapp" ? "#ffffff" : "#666666"} 
            />
            <Text
              style={[
                styles.otpTypeText,
                otpType === "whatsapp" && styles.otpTypeTextActive
              ]}
            >
              WhatsApp
            </Text>
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#e51e25" style={styles.loader} />
            <Text style={styles.loaderText}>
              Sending OTP via {otpType === "text" ? "SMS" : "WhatsApp"}...
            </Text>
          </View>
        ) : (
          <Button 
            title={`Send OTP via ${otpType === "text" ? "SMS" : "WhatsApp"}`}
            onPress={handleLogin} 
            style={styles.button}
            textStyle={styles.buttonText} 
          />
        )}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('register')}>
          <Text style={styles.signupText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#ffffff",
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: "center",
    marginTop: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    marginBottom: 30,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
  },
  input: {
    marginBottom: 15,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    paddingHorizontal: 15,
    width: "100%",
  },
  otpSectionTitle: {
    alignSelf: "flex-start",
    marginLeft: 5,
    marginTop: 10,
    marginBottom: 10,
    fontSize: 16,
    color: "#444444",
    fontWeight: "500",
  },
  optTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  otpTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    width: "48%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  otpTypeButtonActive: {
    backgroundColor: "#e51e25",
    borderColor: "#e51e25",
  },
  otpTypeText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#666666",
    fontWeight: "500",
  },
  otpTypeTextActive: {
    color: "#ffffff",
  },
  button: {
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
  loaderContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  loader: {
    marginBottom: 10,
  },
  loaderText: {
    color: "#e51e25",
    fontSize: 16,
  },
  errorText: {
    color: "#e51e25",
    marginTop: 5,
    fontSize: 14,
    alignSelf: "flex-start",
    marginLeft: 5,
  },
  footer: {
    flexDirection: "row",
    marginTop: 40,
    alignItems: "center",
  },
  footerText: {
    color: "#666666",
    fontSize: 16,
  },
  signupText: {
    color: "#e51e25",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default LoginForm;