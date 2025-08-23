
import { useEffect, useState } from "react"
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Modal, Dimensions } from "react-native"
import { TextInput, Button, Card, ActivityIndicator, Snackbar, Menu } from "react-native-paper"
import axios from "axios"
import { Alert } from "react-native"
import * as SecureStore from "expo-secure-store"
import { useNavigation, useRoute } from "@react-navigation/native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { SafeAreaView } from "react-native-safe-area-context"

const API_BASE_URL = "https://www.webapi.olyox.com/api/v1"
const MAIN_API_BASE_URL = "https://www.appv2.olyox.com/api/v1"

const { width } = Dimensions.get("window")

export default function RegistrationForm() {
  const route = useRoute()
  const navigation = useNavigation()
  const { bh } = route.params || {}

  // Form steps
  const [step, setStep] = useState(1)

  // Form data
  const [userData, setUserData] = useState(null)
  const [date, setDate] = useState(new Date())
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false)
  const [bhId, setBhId] = useState(bh ?? "")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("cab") // cab or parcel
  const [vehicleType, setVehicleType] = useState("")
  const [vehicleTypeId, setVehicleTypeId] = useState("")
  const [vehicleName, setVehicleName] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [rcExpireDate, setRcExpireDate] = useState("")
  const [otp, setOtp] = useState("")

  const [showBhLookupModal, setShowBhLookupModal] = useState(false)
  const [lookupPhone, setLookupPhone] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)

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

  const lookupBhId = async () => {
    if (!lookupPhone || lookupPhone.length !== 10) {
      setError("Please enter a valid 10-digit phone number")
      return
    }

    setLookupLoading(true)
    setError("")

    try {
      // This is a mock API call - replace with actual endpoint
      const response = await axios.post(`${API_BASE_URL}/getProviderDetailsByNumber`, {
        number: lookupPhone
      })

      if (response.data.success && response.data.BH_ID) {
        setBhId(response?.data?.BH_ID)
        setShowBhLookupModal(false)
        setLookupPhone("")
        setSuccess("BH ID found and populated!")
      } else {
        setError("No BH ID found for this phone number")
      }
    } catch (error) {
      console.error("Error looking up BH ID:", error)
      setError("Failed to lookup BH ID. Please try again or contact support.")
    } finally {
      setLookupLoading(false)
    }
  }

  // API functions
  const fetchUserDetails = async () => {
    if (!bhId || bhId.length < 2) {
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
        setSuccess("User details loaded successfully!")
      } else {
        setError("User not found with this BH ID. Please check and try again.")
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
      Alert.alert("Error", "Failed to fetch vehicle types. Please try again later.")
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
      Alert.alert("Error", "Failed to fetch vehicle brands. Please try again later.")
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
      Alert.alert("Error", "Failed to fetch parcel vehicles. Please try again later.")
    }
  }

  const showDatePicker = () => {
    setIsDatePickerVisible(true)
  }

  const hideDatePicker = () => {
    setIsDatePickerVisible(false)
  }

  const formatDate = (date) => {
    if (!date) return ""
    const d = new Date(date)
    const day = d.getDate().toString().padStart(2, "0")
    const month = (d.getMonth() + 1).toString().padStart(2, "0")
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  const handleDateChange = (event, selectedDate) => {
    if (event.type === "set") {
      const newDate = selectedDate || date
      setRcExpireDate(newDate)
      hideDatePicker()
    } else {
      hideDatePicker()
    }
  }

  const registerRider = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError("")

    try {
      const endpoint = `${MAIN_API_BASE_URL}/rider/register`

      const payload = {
        name,
        phone,
        BH: bhId,
        role,
        aadharNumber: userData?.aadharNumber || "",
        rideVehicleInfo: {
          vehicleName,
          vehicleType,
          RcExpireDate: rcExpireDate,
          VehicleNumber: vehicleNumber,
        },
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
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP")
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
        const tokenKey = role === "cab" ? "auth_token_cab" : "auth_token_parcel"
        await SecureStore.setItemAsync(tokenKey, data.token)
        setSuccess("OTP verified successfully!")
        navigation.navigate("UploadDocuments", { role })
      } else {
        setError("Invalid OTP. Please check and try again.")
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
    const missingFields = []

    if (!name.trim()) missingFields.push("Name")
    if (!phone.trim()) missingFields.push("Phone")

    if (role === "cab") {
      if (!vehicleType) missingFields.push("Vehicle Type")
      if (!vehicleName) missingFields.push("Vehicle Brand")
    } else {
      if (!vehicleType) missingFields.push("Parcel Vehicle Type")
    }

    if (!vehicleNumber.trim()) missingFields.push("Vehicle Number")
    if (!rcExpireDate) missingFields.push("RC Expiry Date")

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(", ")}`)
      return false
    }

    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number")
      return false
    }

    if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vehicleNumber.toUpperCase())) {
      setError("Please enter a valid vehicle number (e.g., DL01AB1234)")
      return false
    }

    return true
  }

  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]}>
          <Text style={[styles.progressStepText, step >= 1 && styles.progressStepTextActive]}>1</Text>
        </View>
        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]}>
          <Text style={[styles.progressStepText, step >= 2 && styles.progressStepTextActive]}>2</Text>
        </View>
        <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
        <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]}>
          <Text style={[styles.progressStepText, step >= 3 && styles.progressStepTextActive]}>3</Text>
        </View>
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressLabel}>BH ID</Text>
        <Text style={styles.progressLabel}>Details</Text>
        <Text style={styles.progressLabel}>Verify</Text>
      </View>
    </View>
  )

  const renderBhLookupModal = () => (
    <Modal
      visible={showBhLookupModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowBhLookupModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Find Your BH ID</Text>
          <Text style={styles.modalSubtitle}>Enter your registered phone number to find your BH ID</Text>

          <TextInput
            label="Phone Number *"
            value={lookupPhone}
            onChangeText={setLookupPhone}
            mode="outlined"
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.modalInput}
            autoComplete="tel"
            textContentType="telephoneNumber"
            importantForAutofill="yes"
            placeholder="Enter 10-digit phone number"
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowBhLookupModal(false)
                setLookupPhone("")
              }}
              style={styles.modalButtonSecondary}
              disabled={lookupLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={lookupBhId}
              style={styles.modalButtonPrimary}
              disabled={lookupLoading || lookupPhone.length !== 10}
            >
              {lookupLoading ? "Searching..." : "Find BH ID"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )

  // UI Components
  const renderUserInfo = () => {
    if (!userData) return null

    return (
      <Card style={styles.userInfoCard}>
        <Card.Content>
          <View style={styles.userInfoHeader}>
            <Text style={styles.userInfoTitle}>✓ User Verified</Text>
          </View>
          <View style={styles.userInfoRow}>
            <Text style={styles.userInfoLabel}>Name:</Text>
            <Text style={styles.userInfoValue}>{userData.name}</Text>
          </View>
          {userData.category && (
            <View style={styles.userInfoRow}>
              <Text style={styles.userInfoLabel}>Category:</Text>
              <Text style={styles.userInfoValue}>{userData.category.title}</Text>
            </View>
          )}
          <View style={styles.userInfoRow}>
            <Text style={styles.userInfoLabel}>Aadhar:</Text>
            <Text style={styles.userInfoValue}>{userData.aadharNumber || "Not provided"}</Text>
          </View>
          <Text style={styles.userInfoNote}>*Note: Aadhar number cannot be changed after registration.</Text>
        </Card.Content>
      </Card>
    )
  }

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Enter Your BH ID</Text>
      <Text style={styles.stepSubtitle}>Please enter your BH ID to continue with registration</Text>

      <TextInput
        label="BH ID *"
        value={bhId}
        onChangeText={setBhId}
        mode="outlined"
        style={styles.input}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        placeholder="Enter your BH ID"
        autoCapitalize="characters"
      />

      <TouchableOpacity onPress={() => setShowBhLookupModal(true)} style={styles.helpButton}>
        <Text style={styles.helpButtonText}>Don't know your BH ID? Find it here →</Text>
      </TouchableOpacity>

      <Button
        mode="contained"
        onPress={fetchUserDetails}
        style={styles.primaryButton}
        disabled={loading || !bhId.trim()}
      >
        {loading ? "Verifying..." : "Continue"}
      </Button>

      <TouchableOpacity onPress={() => navigation.navigate("enter_bh")} style={styles.referralLink}>
        <Text style={styles.referralLinkText}>I have a Referral Code</Text>
      </TouchableOpacity>
    </View>
  )

  const renderRoleSelection = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.sectionTitle}>Choose Your Service Type</Text>
      <View style={styles.roleButtonsContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === "cab" && styles.roleButtonActive]}
          onPress={() => setRole("cab")}
        >
          <Text style={styles.roleIcon}>🚗</Text>
          <Text style={[styles.roleButtonText, role === "cab" && styles.roleButtonTextActive]}>Cab Driver</Text>
          <Text style={styles.roleButtonSubtext}>Passenger rides</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === "parcel" && styles.roleButtonActive]}
          onPress={() => setRole("parcel")}
        >
          <Text style={styles.roleIcon}>📦</Text>
          <Text style={[styles.roleButtonText, role === "parcel" && styles.roleButtonTextActive]}>
            Delivery Partner
          </Text>
          <Text style={styles.roleButtonSubtext}>Parcel delivery</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderStep2 = () => (


    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Complete Your Profile</Text>

      {renderUserInfo()}
      {renderRoleSelection()}

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <TextInput
          label="Full Name *"
          value={name}
          editable={false}
          mode="outlined"
          style={[styles.input, styles.disabledInput]}
          autoComplete="name"
          textContentType="name"
          importantForAutofill="no"
        />

        <TextInput
          label="Phone Number *"
          value={phone}
          editable={false}
          mode="outlined"
          style={[styles.input, styles.disabledInput]}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          importantForAutofill="no"
        />
      </View>

      {role === "cab" ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>🚗 Vehicle Information</Text>

          <Menu
            visible={vehicleTypeMenuVisible}
            onDismiss={() => setVehicleTypeMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setVehicleTypeMenuVisible(true)} style={styles.menuButton}>
                <Text style={[styles.menuButtonText, !vehicleType && styles.menuButtonPlaceholder]}>
                  {vehicleType || "Select Vehicle Type *"}
                </Text>
                <Text style={styles.menuButtonIcon}>▼</Text>
              </TouchableOpacity>
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
                <TouchableOpacity onPress={() => setVehicleNameMenuVisible(true)} style={styles.menuButton}>
                  <Text style={[styles.menuButtonText, !vehicleName && styles.menuButtonPlaceholder]}>
                    {vehicleName || "Select Vehicle Brand *"}
                  </Text>
                  <Text style={styles.menuButtonIcon}>▼</Text>
                </TouchableOpacity>
              }
            >
              {vehicleBrands.map((brand, index) => (
                <Menu.Item
                  key={index}
                  onPress={() => {
                    setVehicleName(brand)
                    setVehicleNameMenuVisible(false)
                  }}
                  title={brand}
                />
              ))}
            </Menu>
          )}
        </View>
      ) : (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>📦 Delivery Vehicle Information</Text>

          <Menu
            visible={parcelTypeMenuVisible}
            onDismiss={() => setParcelTypeMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setParcelTypeMenuVisible(true)} style={styles.menuButton}>
                <Text style={[styles.menuButtonText, !vehicleType && styles.menuButtonPlaceholder]}>
                  {vehicleType || "Select Delivery Vehicle Type *"}
                </Text>
                <Text style={styles.menuButtonIcon}>▼</Text>
              </TouchableOpacity>
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
            <View style={styles.selectedVehicleInfo}>
              <Text style={styles.selectedVehicleTitle}>Selected Vehicle:</Text>
              <Text style={styles.selectedVehicleText}>
                {vehicleName} - {vehicleType}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Vehicle Registration Details</Text>

        <TextInput
          label="Vehicle Number *"
          value={vehicleNumber}
          onChangeText={(text) => setVehicleNumber(text.toUpperCase())}
          mode="outlined"
          style={styles.input}
          placeholder="e.g., DL01AB1234"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCapitalize="characters"
        />

        <TouchableOpacity onPress={showDatePicker} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>
            {rcExpireDate ? `RC Expires: ${formatDate(rcExpireDate)}` : "Select RC Expiry Date *"}
          </Text>
          <Text style={styles.dateButtonIcon}>📅</Text>
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

      <Button mode="contained" onPress={registerRider} style={styles.primaryButton} textColor="white" disabled={loading}>
        {loading ? "Submitting Registration..." : "Complete Registration"}
      </Button>
    </View>
  )

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.otpContainer}>
        <Text style={styles.otpIcon}>📱</Text>
        <Text style={styles.stepTitle}>Verify Your Phone</Text>
        <Text style={styles.otpMessage}>We've sent a 6-digit verification code to</Text>
        <Text style={styles.otpPhone}>{phone}</Text>

        <TextInput
          label="Enter 6-digit OTP *"
          value={otp}
          onChangeText={setOtp}
          mode="outlined"
          style={styles.otpInput}
          keyboardType="numeric"
          maxLength={6}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          importantForAutofill="yes"
          placeholder="000000"
        />

        <Button
          mode="contained"
          onPress={verifyOtp}
          style={styles.primaryButton}
          textColor="white"
          disabled={loading || otp.length !== 6}
        >
          {loading ? "Verifying..." : "Verify & Continue"}
        </Button>

        <TouchableOpacity onPress={resendOtp} style={styles.resendButton} disabled={loading}>
          <Text style={styles.resendButtonText}>Didn't receive code? Resend OTP</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {renderProgressIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#dc2626" />
          </View>
        )}
        {/* <Card style={styles.formCard}>
        <Card.Content style={styles.cardContent}>
        </Card.Content>
      </Card> */}

        {renderBhLookupModal()}

        <Snackbar
          visible={!!error || !!success}
          onDismiss={() => {
            setError("")
            setSuccess("")
          }}
          duration={4000}
          style={error ? styles.errorSnackbar : styles.successSnackbar}
        >
          {error || success}
        </Snackbar>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {

    padding: 16,
    backgroundColor: "#f8fafc",
  },
  progressContainer: {
    marginBottom: 24,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepActive: {
    backgroundColor: "#dc2626",
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748b",
  },
  progressStepTextActive: {
    color: "white",
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: "#dc2626",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  progressLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  formCard: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    backgroundColor: "white",
    marginBottom: 16,
  },
  cardContent: {
    padding: 8,
  },
  stepContainer: {
    paddingVertical: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "white",
  },
  disabledInput: {
    backgroundColor: "#f1f5f9",
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    color: "white",
    backgroundColor: "#dc2626",
    borderRadius: 12,
    elevation: 3,
  },
  helpButton: {
    alignItems: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderStyle: "dashed",
  },
  helpButtonText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "600",
  },
  referralLink: {
    alignItems: "center",
    marginTop: 16,
    padding: 8,
  },
  referralLinkText: {
    fontSize: 16,
    color: "#dc2626",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  userInfoCard: {
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  userInfoHeader: {
    marginBottom: 12,
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#dc2626",
  },
  userInfoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  userInfoLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    width: 80,
  },
  userInfoValue: {
    fontSize: 14,
    color: "#991b1b",
    fontWeight: "600",
    flex: 1,
  },
  userInfoNote: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 8,
  },
  roleContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 12,
  },
  roleButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "white",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  roleButtonActive: {
    backgroundColor: "#fef2f2",
    borderColor: "#dc2626",
  },
  roleIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  roleButtonTextActive: {
    color: "#dc2626",
  },
  roleButtonSubtext: {
    fontSize: 12,
    color: "#94a3b8",
  },
  formSection: {
    marginBottom: 24,
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 16,
  },
  menuButtonText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "500",
  },
  menuButtonPlaceholder: {
    color: "#94a3b8",
  },
  menuButtonIcon: {
    fontSize: 12,
    color: "#64748b",
  },
  selectedVehicleInfo: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedVehicleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 4,
  },
  selectedVehicleText: {
    fontSize: 14,
    color: "#475569",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "500",
  },
  dateButtonIcon: {
    fontSize: 16,
  },
  otpContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  otpIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  otpMessage: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 4,
  },
  otpPhone: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 24,
  },
  otpInput: {
    fontSize: 20,
    marginBottom: 24,
    backgroundColor: "white",
    textAlign: "center",
    letterSpacing: 8,
    width: "100%",
  },
  resendButton: {
    marginTop: 16,
    padding: 8,
  },
  resendButtonText: {
    fontSize: 14,
    color: "#dc2626",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: width - 32,
    maxWidth: 400,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalInput: {
    marginBottom: 24,
    backgroundColor: "white",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    borderColor: "#d1d5db",
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: "#dc2626",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  errorSnackbar: {
    backgroundColor: "#dc2626",
  },
  successSnackbar: {
    backgroundColor: "#10b981",
  },
})
