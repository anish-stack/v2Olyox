"use client"

import { useState, useEffect } from "react"
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from "react-native"
import { useRoute, useNavigation } from "@react-navigation/native"
import axios from "axios"
import FormInput from "./FormInput"
import AddressForm from "./AddressForm"
import BhVerificationError from "./BhVerificationError"
import DateTimePicker from "@react-native-community/datetimepicker"

const { width, height } = Dimensions.get("window")

export default function RegisterWithBh() {
  const route = useRoute()
  const navigation = useNavigation()
  const { bh_id } = route.params || {}

  const [date, setDate] = useState(new Date())
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false)
  const [isBhVerify, setIsBhVerify] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState([])
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [bhVerifyLoading, setBhVerifyLoading] = useState(false)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    reEmail: "",
    number: "",
    password: "",
    category: "676ef9685c75082fcbc59c4f",
    address: {
      street_address: "",
      location: {
        type: "Point",
        coordinates: [78.2693, 25.369],
      },
    },
    aadharNumber: "",
    dob: "",
    member_id: "",
    referral_code_which_applied: bh_id,
    is_referral_applied: true,
  })

  useEffect(() => {
    initializeComponent()
  }, [bh_id])

  const initializeComponent = async () => {
    setLoading(true)
    await Promise.all([checkBhId(), fetchCategory()])
    setLoading(false)
  }

  // Aadhaar regex for format XXXX XXXX XXXX
  const aadharRegex = /^[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}$/

  // Format Aadhaar number as user types
  const formatAadhar = (text) => {
    const cleaned = text.replace(/\s/g, "")
    let formatted = ""
    for (let i = 0; i < cleaned.length && i < 12; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += " "
      }
      formatted += cleaned[i]
    }
    return formatted
  }

  // Enhanced validation with more detailed error messages
  const validateField = (field, value) => {
    let error = null

    switch (field) {
      case "name":
        if (!value.trim()) {
          error = "Name is required"
        } else if (value.trim().length < 2) {
          error = "Name must be at least 2 characters"
        } else if (!/^[a-zA-Z\s]+$/.test(value.trim())) {
          error = "Name can only contain letters and spaces"
        }
        break

      case "email":
        if (!value.trim()) {
          error = "Email address is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Please enter a valid email address"
        }
        break

      case "number":
        if (!value.trim()) {
          error = "Phone number is required"
        } else if (!/^\d{10}$/.test(value)) {
          error = "Phone number must be exactly 10 digits"
        } else if (!/^[6-9]/.test(value)) {
          error = "Phone number must start with 6, 7, 8, or 9"
        }
        break

      case "password":
        if (!value.trim()) {
          error = "Password is required"
        } else if (value.length < 8) {
          error = "Password must be at least 8 characters"
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          error = "Password must contain uppercase, lowercase, and number"
        }
        break

      case "aadharNumber":
        if (!value.trim()) {
          error = "Aadhaar number is required"
        } else if (!aadharRegex.test(value)) {
          error = "Enter valid Aadhaar number (XXXX XXXX XXXX)"
        }
        break

      case "dob":
        if (!value) {
          error = "Date of birth is required"
        }
        break
    }

    return error
  }

  // Handle input changes with real-time validation
  const handleInputChange = (field, value) => {
    let newValue = value

    // Special formatting for Aadhaar
    if (field === "aadharNumber") {
      newValue = formatAadhar(value)
    }

    // Update form data
    setFormData((prev) => ({
      ...prev,
      [field]: newValue,
    }))

    // Clear submit error when user starts typing
    if (submitError) setSubmitError("")

    // Validate field and update errors
    const fieldError = validateField(field, newValue)
    setErrors((prev) => ({
      ...prev,
      [field]: fieldError,
    }))
  }

  const showDatePicker = () => {
    setIsDatePickerVisible(true)
  }

  const hideDatePicker = () => {
    setIsDatePickerVisible(false)
  }

  const handleDateChange = (event, selectedDate) => {
    if (event.type === "set") {
      const newDate = selectedDate || date

      // Calculate age
      const today = new Date()
      const birthDate = new Date(newDate)
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDifference = today.getMonth() - birthDate.getMonth()

      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      if (age < 18) {
        Alert.alert("Age Restriction", "You must be at least 18 years old to register.", [{ text: "OK" }])
        setErrors((prev) => ({
          ...prev,
          dob: "Must be at least 18 years old",
        }))
        hideDatePicker()
        return
      }

      // Store the Date object directly
      setFormData((prev) => ({
        ...prev,
        dob: newDate,
      }))

      // Clear error if date is valid
      setErrors((prev) => ({
        ...prev,
        dob: null,
      }))

      hideDatePicker()
    } else {
      hideDatePicker()
    }
  }

  const checkBhId = async () => {
    if (!bh_id) {
      setIsBhVerify(true)
      return
    }

    setBhVerifyLoading(true)
    try {
      const { data } = await axios.post("https://www.api.olyox.com/api/v1/check-bh-id", {
        bh: bh_id,
      })
      setIsBhVerify(data.success)
    } catch (err) {
      console.error("BH verification error:", err)
      setIsBhVerify(false)
    } finally {
      setBhVerifyLoading(false)
    }
  }

  const fetchCategory = async () => {
    setCategoryLoading(true)
    try {
      const { data } = await axios.get("https://www.api.olyox.com/api/v1/categories_get")
      setCategories(data.data || [])
    } catch (err) {
      console.error("Error fetching categories:", err)
      Alert.alert("Error", "Failed to load categories. Please try again.")
    } finally {
      setCategoryLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    // Validate all required fields
    const fieldsToValidate = ["name", "email", "number", "password", "aadharNumber", "dob"]

    fieldsToValidate.forEach((field) => {
      const error = validateField(field, formData[field])
      if (error) newErrors[field] = error
    })

    // Validate address
    if (!formData.address.street_address.trim()) {
      newErrors.address = "Address is required"
    }

    // Validate terms
    if (!termsAccepted) {
      newErrors.terms = "You must accept the terms and conditions"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    // Clear previous submit error
    setSubmitError("")

    if (!validateForm()) {
      Alert.alert("Validation Error", "Please correct all errors before submitting.")
      return
    }

    setSubmitting(true)

    try {
      const response = await axios.post("https://webapi.olyox.com/api/v1/register_vendor", formData, {
        timeout: 30000, // 30 second timeout
      })

      if (response.data?.success) {
        Alert.alert("Registration Successful", "An OTP has been sent to your WhatsApp. Please verify to continue.", [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate("OtpVerify", {
                type: response.data.type,
                email: response.data.email,
                expireTime: response.data.time,
                number: response.data.number,
              }),
          },
        ])
      } else {
        throw new Error(response.data?.message || "Registration failed")
      }
    } catch (error) {
      console.error("Registration error:", error)

      let errorMessage = "Registration failed. Please try again."

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "Request timeout. Please check your internet connection."
      } else if (error.message) {
        errorMessage = error.message
      }

      setSubmitError(errorMessage)
      Alert.alert("Registration Error", errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return ""
    const d = new Date(date)
    const day = d.getDate().toString().padStart(2, "0")
    const month = (d.getMonth() + 1).toString().padStart(2, "0")
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Loading Modal Component
  const LoadingModal = ({ visible, message }) => (
    <Modal transparent={true} animationType="fade" visible={visible} onRequestClose={() => {}}>
      <View style={styles.modalOverlay}>
        <View style={styles.loadingModalContent}>
          <ActivityIndicator size="large" color="#ff0000" />
          <Text style={styles.loadingText}>{message}</Text>
        </View>
      </View>
    </Modal>
  )

  // Error Display Component
  const ErrorDisplay = ({ error }) => {
    if (!error) return null
    return <Text style={styles.errorText}>{error}</Text>
  }

  // Show BH verification error
  if (!isBhVerify && bh_id && !bhVerifyLoading) {
    return <BhVerificationError />
  }

  // Show initial loading
  if (loading || bhVerifyLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff0000" />
        <Text style={styles.loadingText}>{bhVerifyLoading ? "Verifying BH ID..." : "Loading..."}</Text>
      </View>
    )
  }

  // Registration Form
  const renderRegistrationForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Vendor Cab Registration</Text>

      {submitError ? (
        <View style={styles.submitErrorContainer}>
          <Text style={styles.submitErrorText}>{submitError}</Text>
        </View>
      ) : null}

      <FormInput
        key="name-input"
        label="Name (as per Aadhaar Card) *"
        value={formData.name}
        onChangeText={(text) => handleInputChange("name", text)}
        error={errors.name}
        placeholder="Enter your full name"
        autoComplete="name"
        textContentType="name"
        autoCorrect={true}
      />

      <FormInput
        key="aadhaar-input"
        label="Aadhaar Number *"
        value={formData.aadharNumber}
        onChangeText={(text) => handleInputChange("aadharNumber", text)}
        error={errors.aadharNumber}
        placeholder="XXXX XXXX XXXX"
        keyboardType="text"
        maxLength={14}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        autoCorrect={false}
      />

      <View style={styles.datePickerContainer}>
        <Text style={styles.label}>Date of Birth *</Text>
        <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
          <Text style={styles.dateButtonText}>{formData.dob ? formatDate(formData.dob) : "Select Date of Birth"}</Text>
        </TouchableOpacity>
        <ErrorDisplay error={errors.dob} />

        {isDatePickerVisible && (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={handleDateChange}
            display="default"
            maximumDate={new Date()}
          />
        )}
      </View>

      <FormInput
        key="email-input"
        label="Email Address *"
        value={formData.email}
        onChangeText={(text) => handleInputChange("email", text)}
        error={errors.email}
        placeholder="Enter your email address"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
      />

      <FormInput
        key="phone-input"
        label="Phone Number *"
        value={formData.number}
        onChangeText={(text) => handleInputChange("number", text)}
        error={errors.number}
        placeholder="Enter 10-digit phone number"
        keyboardType="phone-pad"
        maxLength={10}
        autoComplete="tel"
        textContentType="telephoneNumber"
        importantForAutofill="yes"
        autoCorrect={false}
      />

      <FormInput
        key="password-input"
        label="Password *"
        value={formData.password}
        onChangeText={(text) => handleInputChange("password", text)}
        error={errors.password}
        placeholder="Create a strong password"
        secureTextEntry
        autoComplete="password-new"
        textContentType="newPassword"
        importantForAutofill="no"
        autoCorrect={false}
      />

      <AddressForm
        address={formData.address}
        onAddressChange={(field, value) =>
          setFormData({
            ...formData,
            address: {
              ...formData.address,
              [field]: value,
            },
          })
        }
        errors={errors}
      />

      <View style={styles.termsContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => {
            setTermsAccepted(!termsAccepted)
            if (errors.terms) {
              setErrors((prev) => ({ ...prev, terms: null }))
            }
          }}
        >
          <View style={[styles.checkboxInner, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        <Text style={styles.termsText}>I accept the Terms and Conditions *</Text>
      </View>
      <ErrorDisplay error={errors.terms} />

      <TouchableOpacity
        style={[styles.submitButton, (submitting || !termsAccepted) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !termsAccepted}
      >
        <Text style={styles.buttonText}>{submitting ? "Registering..." : "Register Now"}</Text>
        {submitting && <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />}
      </TouchableOpacity>
    </View>
  )

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {renderRegistrationForm()}
      </ScrollView>

      <LoadingModal visible={submitting} message="Creating your account..." />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  formContainer: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginVertical: 15,
    marginHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 25,
    color: "#333",
  },
  submitErrorContainer: {
    backgroundColor: "#fee",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fcc",
  },
  submitErrorText: {
    color: "#c33",
    fontSize: 14,
    textAlign: "center",
  },
  datePickerContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
    fontWeight: "600",
  },
  dateButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    justifyContent: "center",
  },
  dateButtonText: {
    fontSize: 16,
    color: "#333",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  submitButton: {
    backgroundColor: "#ff0000",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 25,
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#ff0000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonLoader: {
    marginLeft: 10,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 5,
  },
  checkbox: {
    height: 24,
    width: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ddd",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxInner: {
    height: 16,
    width: 16,
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#ff0000",
  },
  checkmark: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  termsText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingModalContent: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
