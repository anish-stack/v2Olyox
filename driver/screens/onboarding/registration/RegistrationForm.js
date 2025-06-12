import { useEffect, useState } from "react"
import { View, StyleSheet, Text, ScrollView, ImageBackground, TouchableOpacity } from "react-native"
import { TextInput, Button, Card, Title, Paragraph, ActivityIndicator, Snackbar, Menu, Chip } from "react-native-paper"
import axios from "axios"
import { Alert } from "react-native"
import * as SecureStore from 'expo-secure-store'
import { useNavigation, useRoute } from "@react-navigation/native"
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE_URL = "https://www.webapi.olyox.com/api/v1"
const MAIN_API_BASE_URL = "https://appapi.olyox.com/api/v1"

export default function RegistrationForm() {
  const route = useRoute()
  const navigation = useNavigation()
  const { bh } = route.params || {}

  // Form steps
  const [step, setStep] = useState(1)

  // Form data
  const [userData, setUserData] = useState(null)
  const [date, setDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [bhId, setBhId] = useState(bh ?? "BH")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("cab") // cab or parcel
  const [vehicleType, setVehicleType] = useState("")
  const [vehicleTypeId, setVehicleTypeId] = useState("")
  const [vehicleName, setVehicleName] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [rcExpireDate, setRcExpireDate] = useState("")
  const [otp, setOtp] = useState("")

  // Data lists
  const [vehicleTypes, setVehicleTypes] = useState([])
  const [vehicleBrands, setVehicleBrands] = useState([])
  const [parcelVehicles, setParcelVehicles] = useState([])

  // UI states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [vehicleTypeMenuVisible, setVehicleTypeMenuVisible] = useState(false)
  const [vehicleNameMenuVisible, setVehicleNameMenuVisible] = useState(false)
  const [parcelTypeMenuVisible, setParcelTypeMenuVisible] = useState(false)

  // Fetch initial data
  useEffect(() => {
    fetchVehicleTypes()
    fetchParcelVehicles()
  }, [])

  // Fetch vehicle brands when a vehicle type is selected
  useEffect(() => {
    if (vehicleTypeId && role === "cab") {
      fetchVehicleBrands(vehicleTypeId)
    }
  }, [vehicleTypeId, role])

  // API functions
  const fetchUserDetails = async () => {
    if (!bhId || bhId === "BH") {
      setError("Please enter a valid BH ID")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await axios.get(`${API_BASE_URL}/app-get-details?Bh=${bhId}`)

      if (response.data.success) {
        setUserData(response.data.data)
        setName(response.data.data.name)
        setPhone(response.data.data.number || "")
        setStep(2)
      } else {
        setError("User not found with this BH ID")
      }
    } catch (error) {
      console.error("Error fetching user details:", error)
      setError("Failed to fetch user details. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }

  const fetchVehicleTypes = async () => {
    try {
      const response = await axios.get(`${MAIN_API_BASE_URL}/admin/getAllSuggestions`)
      if (response.data.success) {
        setVehicleTypes(response.data.data)
      }
    } catch (error) {
      console.error("Error fetching vehicle types:", error)
      Alert.alert('Error', 'Failed to fetch vehicle types. Please try again later.')
    }
  }

  const fetchVehicleBrands = async (typeId) => {
    try {
      const response = await axios.get(`${MAIN_API_BASE_URL}/admin/ride-sub-suggestion/by-category/${typeId}`)
      if (response.data.success && response.data.data.length > 0) {
        setVehicleBrands(response.data.data[0].subCategory || [])
      } else {
        setVehicleBrands([])
      }
    } catch (error) {
      console.error("Error fetching vehicle brands:", error)
      setVehicleBrands([])
      Alert.alert('Error', 'Failed to fetch vehicle brands. Please try again later.')
    }
  }

  const fetchParcelVehicles = async () => {
    try {
      const response = await axios.get(`${MAIN_API_BASE_URL}/parcel/all-parcel`)
      if (response.data.success) {
        setParcelVehicles(response.data.data)
      }
    } catch (error) {
      console.error("Error fetching parcel vehicles:", error)
      Alert.alert('Error', 'Failed to fetch parcel vehicles. Please try again later.')
    }
  }

  const showDatePicker = () => {
    setIsDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };
  
  const handleDateChange = (event, selectedDate) => {
    if (event.type === "set") {
      const newDate = selectedDate || date; 
      setRcExpireDate(newDate)
      hideDatePicker();
    } else {
      hideDatePicker();
    }
  };


  const registerRider = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError("")

    try {
      const endpoint = `${MAIN_API_BASE_URL}/rider/register`
      // const endpoint = `http://192.168.1.10:3100/api/v1/rider/register`


      const payload = {
        name,
        phone,
        BH: bhId,
        role,
        aadharNumber: userData?.aadharNumber || '',
        rideVehicleInfo: {
          vehicleName,
          vehicleType,
          RcExpireDate: rcExpireDate,
          VehicleNumber: vehicleNumber,
        }
      }

      const response = await axios.post(endpoint, payload)

      if (response.data.success) {
        setStep(3)
        setSuccess("Registration successful! Please enter the OTP sent to your phone.")
      } else {
        setError(response.data.message || "Registration failed")
      }
    } catch (error) {
      console.error("Error registering rider:", error)
      setError(error.response?.data.message || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (!otp) {
      setError("Please enter the OTP")
      return
    }

    setLoading(true)
    setError("")

    try {
      const endpoint = `${MAIN_API_BASE_URL}/rider/rider-verify`

      const { data } = await axios.post(endpoint, {
        number: phone,
        otp,
      })

      if (data.success && data.token) {
        const tokenKey = role === "cab" ? 'auth_token_cab' : 'auth_token_cab'
        await SecureStore.setItemAsync(tokenKey, data.token)
        setSuccess("OTP verified successfully!")
        navigation.navigate('UploadDocuments', { role })
      } else {
        setError("Verification failed. Please check the OTP.")
      }
    } catch (error) {
      console.error("Error verifying OTP:", error)
      setError(error.response?.data.message || "OTP verification failed")
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    setLoading(true)
    setError("")

    try {
      const endpoint = `${MAIN_API_BASE_URL}/rider/rider-resend`

      const { data } = await axios.post(endpoint, { number: phone })

      if (data.success) {
        setSuccess("OTP resent successfully!")
      } else {
        setError("Failed to resend OTP")
      }
    } catch (error) {
      console.error("Error resending OTP:", error)
      setError(error.response?.data.message || "Failed to resend OTP")
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    let missingFields = []

    if (!name) missingFields.push("Name")
    if (!phone) missingFields.push("Phone")

    if (role === "cab") {
      if (!vehicleType) missingFields.push("Vehicle Type")
      if (!vehicleName) missingFields.push("Vehicle Brand")
    } else {
      if (!vehicleType) missingFields.push("Parcel Vehicle Type")
    }

    if (!vehicleNumber) missingFields.push("Vehicle Number")
    if (!rcExpireDate) missingFields.push("RC Expiry Date")

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(", ")}`)
      return false
    }

    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number")
      return false
    }

    return true
  }

  // UI Components
  const renderUserInfo = () => {
    if (!userData) return null

    return (
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>User Information</Title>
          <Paragraph style={styles.cardParagraph}>Name: {userData.name}</Paragraph>
          {userData.category && (
            <Paragraph style={styles.cardParagraph}>
              Category: {userData.category.title}
            </Paragraph>
          )}
          <Paragraph style={styles.cardParagraph}>
            Aadhar Number: {userData.aadharNumber || ''}
          </Paragraph>
          <Text>  *Note: Aadhar number cannot be changed after registration.</Text>
        </Card.Content>
      </Card>
    )
  }

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <TextInput
        label="BH ID"
        value={bhId}
        onChangeText={setBhId}
        mode="outlined"
        keyboardType="phone-pad"
        style={styles.input}

      />
      <Button
        mode="contained"
        onPress={fetchUserDetails}
        style={styles.button}
        labelStyle={styles.buttonLabel}
        disabled={loading}
      >
        {loading ? 'Checking...' : 'Next'}
      </Button>
      <TouchableOpacity onPress={() => navigation.navigate('enter_bh')} style={styles.referralCode}>
        <Text style={styles.referralCodeText}>I have a Referral code</Text>
      </TouchableOpacity>
    </View>
  )

  const renderRoleSelection = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.sectionTitle}>Register as:</Text>
      <View style={styles.roleButtonsContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === "cab" && styles.roleButtonActive]}
          onPress={() => setRole("cab")}
        >
          <Text style={[styles.roleButtonText, role === "cab" && styles.roleButtonTextActive]}>
            Cab Driver
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === "parcel" && styles.roleButtonActive]}
          onPress={() => setRole("parcel")}
        >
          <Text style={[styles.roleButtonText, role === "parcel" && styles.roleButtonTextActive]}>
            Parcel Delivery
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      {renderUserInfo()}
      {renderRoleSelection()}

      <TextInput
        label="Name"
        value={name}
        editable={false}
        mode="outlined"
        style={styles.input}
        theme={{ colors: { primary: "#f7de02" } }}
      />

      <TextInput
        label="Phone Number"
        value={phone}
        editable={false}
        mode="outlined"
        style={styles.input}
        keyboardType="phone-pad"
        theme={{ colors: { primary: "#f7de02" } }}
      />

      {role === "cab" ? (
        <>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <Menu
            visible={vehicleTypeMenuVisible}
            onDismiss={() => setVehicleTypeMenuVisible(false)}
            anchor={
              <Button
                onPress={() => setVehicleTypeMenuVisible(true)}
                mode="outlined"
                style={styles.input}
              >
                {vehicleType || "Select Vehicle Type"}
              </Button>
            }
          >
            {vehicleTypes.map((type) => (
              <Menu.Item
                key={type._id}
                onPress={() => {
                  setVehicleType(type.name)
                  setVehicleTypeId(type._id)
                  setVehicleTypeMenuVisible(false)
                  setVehicleName("") // Reset vehicle name when type changes
                }}
                title={type.name || "N/A"}
              />
            ))}
          </Menu>

          {vehicleTypeId && (
            <Menu
              visible={vehicleNameMenuVisible}
              onDismiss={() => setVehicleNameMenuVisible(false)}
              anchor={
                <Button
                  onPress={() => setVehicleNameMenuVisible(true)}
                  mode="outlined"
                  style={styles.input}
                >
                  {vehicleName || "Select Vehicle Brand"}
                </Button>
              }
            >
              {vehicleBrands.map((brand) => (
                <Menu.Item
                  key={brand}
                  onPress={() => {
                    setVehicleName(brand)
                    setVehicleNameMenuVisible(false)
                  }}
                  title={brand}
                />
              ))}
            </Menu>
          )}
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Parcel Vehicle Information</Text>
          <Menu
            visible={parcelTypeMenuVisible}
            onDismiss={() => setParcelTypeMenuVisible(false)}
            anchor={
              <Button
                onPress={() => setParcelTypeMenuVisible(true)}
                mode="outlined"
                style={styles.input}
              >
                {vehicleType || "Select Parcel Vehicle Type"}
              </Button>
            }
          >
            {parcelVehicles.map((vehicle) => (
              <Menu.Item
                key={vehicle._id}
                onPress={() => {
                  setVehicleType(vehicle.info)
                  setVehicleName(vehicle.title)
                  setParcelTypeMenuVisible(false)
                }}
                title={`${vehicle.title} (${vehicle.info})`}
              />
            ))}
          </Menu>

          {vehicleType && (
            <View style={styles.infoView}>
              <Text style={styles.infoText}>
                Vehicle Type: {vehicleType}
              </Text>
              {vehicleName && (
                <Text style={styles.infoText}>
                  Info: {vehicleName}
                </Text>
              )}
            </View>
          )}
        </>
      )}

      <TextInput
        label="Vehicle Number"
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
        mode="outlined"
        style={styles.input}
        placeholder="e.g., DL01AB1234"
        theme={{ colors: { primary: "#f7de02" } }}
      />
      <View style={{ marginVertical: 10 }}>
        <TouchableOpacity
          onPress={showDatePicker}
          style={{
            backgroundColor: '#000',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
            Select RC Expiry Date
          </Text>
        </TouchableOpacity>

        {isDatePickerVisible && (
          <DateTimePicker
            value={date}
            mode="date"
            display="calendar"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>


      <TextInput
        label="RC Expiry Date"
        value={rcExpireDate ? formatDate(rcExpireDate) : ""}
        editable={false}
        mode="outlined"
        placeholder="YYYY-MM-DD"
        style={styles.input}
      />


      <Button
        mode="contained"
        onPress={registerRider}
        style={styles.button}
        labelStyle={styles.buttonLabel}
        disabled={loading}
      >
        {loading ? 'Submitting...' : 'Register'}
      </Button>
    </View>
  )

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Card style={styles.otpCard}>
        <Card.Content>
          <Title style={styles.otpTitle}>Verify Your Number</Title>
          <Paragraph style={styles.otpMessage}>
            We have sent an OTP to {phone}. Please enter it below.
          </Paragraph>

          <TextInput
            label="Enter OTP"
            value={otp}
            onChangeText={setOtp}
            mode="outlined"
            style={styles.otpInput}
            keyboardType="numeric"
            maxLength={6}
            theme={{ colors: { primary: "#f7de02" } }}
          />

          <Button
            mode="contained"
            onPress={verifyOtp}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>

          <Button
            mode="text"
            onPress={resendOtp}
            style={styles.resendButton}
            labelStyle={styles.resendButtonLabel}
            disabled={loading}
          >
            Resend OTP
          </Button>
        </Card.Content>
      </Card>
    </View>
  )

  return (
    // <ImageBackground 
    //   source={require('../assets/background.jpg')} 
    //   style={styles.backgroundImage}
    //   defaultSource={require('../assets/background-placeholder.jpg')}
    // >
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Card style={styles.formCard}>
        <Card.Content>
          <Title style={styles.title}>
            {step === 1 ? "Enter Your BH ID" :
              step === 2 ? "Driver Registration" :
                null}
          </Title>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {loading && <ActivityIndicator animating={true} style={styles.loader} color="#f7de02" />}
        </Card.Content>
      </Card>

      <Snackbar
        visible={!!error || !!success}
        onDismiss={() => {
          setError("")
          setSuccess("")
        }}
        duration={3000}
        style={error ? styles.errorSnackbar : styles.successSnackbar}
      >
        {error || success}
      </Snackbar>
    </ScrollView>
    // </ImageBackground>
  )
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
  },
  container: {
    flexGrow: 1,
    padding: 14,
    justifyContent: "center",
  },
  formCard: {
    borderRadius: 15,
    elevation: 5,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  stepContainer: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 15,
    backgroundColor: "white",
  },
  button: {
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: "#f7de02",
    borderRadius: 8,
    elevation: 2,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  card: {
    marginBottom: 20,
    borderRadius: 10,
    elevation: 3,
    backgroundColor: "#FFF8E1",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  cardParagraph: {
    fontSize: 16,
    marginBottom: 5,
    color: "#555",
  },
  loader: {
    marginTop: 20,
  },
  errorSnackbar: {
    backgroundColor: "#FF5252",
  },
  successSnackbar: {
    backgroundColor: "#4CAF50",
  },
  roleContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
    marginTop: 10,
  },
  roleButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  roleButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginHorizontal: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  roleButtonActive: {
    backgroundColor: "#f7de02",
    borderColor: "#e6cc00",
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#555",
  },
  roleButtonTextActive: {
    color: "#333",
    fontWeight: "bold",
  },
  infoView: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
  },
  otpCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FFF8E1",
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    marginBottom: 15,
  },
  otpMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },
  otpInput: {
    fontSize: 18,
    marginBottom: 20,
    backgroundColor: "white",
    textAlign: "center",
    letterSpacing: 5,
  },
  resendButton: {
    marginTop: 10,
  },
  resendButtonLabel: {
    color: "#3d7de2",
    fontSize: 14,
  },
  referralCode: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  referralCodeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3d7de2",
    textDecorationLine: "underline",
  },
})