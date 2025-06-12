import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Button,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import FormInput from './FormInput';
import AddressForm from './AddressForm';
import BhVerificationError from './BhVerificationError';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RegisterWithBh() {
  const route = useRoute();
  const navigation = useNavigation();
  const { bh_id } = route.params || {};
  const [date, setDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isBhVerify, setIsBhVerify] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginErrors, setLoginErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    reEmail: '',
    number: '',
    password: '',
    category: '676ef9685c75082fcbc59c4f',
    address: {
      area: '',
      street_address: '',
      landmark: '',
      pincode: '',
      location: {
        type: 'Point',
        coordinates: [78.2693, 25.369],
      },
    },
    aadharNumber: '',
    dob: '',
    member_id: '',
    referral_code_which_applied: bh_id,
    is_referral_applied: true,
  });

  useEffect(() => {
    checkBhId();
    fetchCategory();
  }, [bh_id]);

  // Aadhaar regex for format XXXX XXXX XXXX
  const aadharRegex = /^[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}$/;

  // Format Aadhaar number as user types
  const formatAadhar = (text) => {
    // Remove all spaces first
    const cleaned = text.replace(/\s/g, '');
    
    // Add spaces after every 4 characters
    let formatted = '';
    for (let i = 0; i < cleaned.length && i < 12; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += cleaned[i];
    }
    
    return formatted;
  };

  // Validate a specific field
  const validateField = (field, value) => {
    let error = null;
    
    switch (field) {
      case 'name':
        if (!value.trim()) error = 'Please enter your name.';
        break;
      case 'email':
        if (!value.trim()) {
          error = 'Please provide your email address.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address.';
        }
        break;
      case 'reEmail':
        if (!value.trim()) {
          error = 'Please re-enter your email address.';
        } else if (value !== formData.email) {
          error = 'Emails do not match.';
        }
        break;
      case 'number':
        if (!value.trim()) {
          error = 'Please enter your phone number.';
        } else if (!/^\d{10}$/.test(value)) {
          error = 'Phone number must be exactly 10 digits.';
        }
        break;
      case 'password':
        if (!value.trim()) {
          error = 'Please create a password.';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters long.';
        }
        break;
      case 'aadharNumber':
        if (!value.trim()) {
          error = 'Please enter your Aadhaar number.';
        } else if (!aadharRegex.test(value)) {
          error = 'Please enter a valid Aadhaar number (XXXX XXXX XXXX).';
        }
        break;
      case 'dob':
        if (!value) {
          error = 'Please enter your date of birth.';
        }
        break;
    }
    
    return error;
  };

  // Handle input changes with validation
  const handleInputChange = (field, value) => {
    let newValue = value;
    
    // Special formatting for Aadhaar
    if (field === 'aadharNumber') {
      newValue = formatAadhar(value);
    }
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      [field]: newValue
    }));
    
    // Validate field
    const fieldError = validateField(field, newValue);
    
    // Update errors
    setErrors(prev => ({
      ...prev,
      [field]: fieldError
    }));
    
    // For email confirmation, also check reEmail when email changes
    if (field === 'email' && formData.reEmail) {
      const reEmailError = validateField('reEmail', formData.reEmail);
      setErrors(prev => ({
        ...prev,
        reEmail: reEmailError
      }));
    }
  };

  const showDatePicker = () => {
    setIsDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  const handleDateChange = (event, selectedDate) => {
    if (event.type === "set") {
      const newDate = selectedDate || date;

      // Calculate age
      const today = new Date();
      const birthDate = new Date(newDate);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();

      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        Alert.alert("Age Restriction", "You must be at least 18 years old to register.");
        hideDatePicker();
        return;
      }

      // Store the Date object directly
      setFormData((prev) => ({
        ...prev,
        dob: newDate,
      }));
      
      // Clear error if date is valid
      setErrors(prev => ({
        ...prev,
        dob: null
      }));

      hideDatePicker();
    } else {
      hideDatePicker();
    }
  };

  const checkBhId = async () => {
    try {
      const { data } = await axios.post('https://www.api.olyox.com/api/v1/check-bh-id', { bh: bh_id });
      setIsBhVerify(data.success);
    } catch (err) {
      console.error(err);
      setIsBhVerify(false);
    }
  };

  const fetchCategory = async () => {
    try {
      const { data } = await axios.get('https://www.api.olyox.com/api/v1/categories_get');
      setCategories(data.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate all fields
    Object.keys(formData).forEach(field => {
      if (field !== 'address' && field !== 'category' && field !== 'member_id' && 
          field !== 'referral_code_which_applied' && field !== 'is_referral_applied') {
        const error = validateField(field, formData[field]);
        if (error) newErrors[field] = error;
      }
    });
    
    // Validate address fields
    if (!formData.address.pincode.trim()) newErrors.pincode = 'Please enter your pincode.';
    
    // Check terms and conditions
    if (!termsAccepted) {
      newErrors.terms = 'You must accept the terms and conditions to proceed.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const response = await axios.post(
        'https://webapi.olyox.com/api/v1/register_vendor',
        formData
      );

      if (response.data?.success) {
        Alert.alert(
          "Registration Successful",
          "An OTP has been sent to your WhatsApp. Please verify to continue.",
          [
            { 
              text: "OK", 
              onPress: () => navigation.navigate('OtpVerify', {
               	type: response.data.type,
                email: response.data.email,
                expireTime: response.data.time,
                number: response.data.number,
              })
            }
          ]
        );
      }
    } catch (error) {
      console.log(error.response?.data);
      const errorMessage = error.response?.data?.message || 'Registration failed';
      Alert.alert("Registration Error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

 
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };



  if (!isBhVerify && bh_id) {
    return <BhVerificationError />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  // Registration Form
  const renderRegistrationForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Vendor Cab Registration</Text>

      <FormInput
        label="Name (as per Aadhaar Card)"
        value={formData.name}
        onChangeText={(text) => handleInputChange('name', text)}
        error={errors.name}
        placeholder="Enter your name"
      />

      <FormInput
        label="Aadhaar Number"
        value={formData.aadharNumber}
        onChangeText={(text) => handleInputChange('aadharNumber', text)}
        error={errors.aadharNumber}
        placeholder="XXXX XXXX XXXX"
        keyboardType="numeric"
        maxLength={14} // 12 digits + 2 spaces
      />

      <View style={styles.datePickerContainer}>
        <Text style={styles.label}>Date of Birth</Text>
        <Button title="Select Date of Birth" onPress={showDatePicker} />
        {isDatePickerVisible && (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={handleDateChange}
            display="default"
          />
        )}
        <FormInput
          editable={false}
          value={formData.dob ? formatDate(formData.dob) : ""}
          error={errors.dob}
          placeholder="DD-MM-YYYY"
        />
      </View>

      <FormInput
        label="Email"
        value={formData.email}
        onChangeText={(text) => handleInputChange('email', text)}
        error={errors.email}
        placeholder="Enter your email"
        keyboardType="email-address"
      />

      <FormInput
        label="Re-enter Email"
        value={formData.reEmail}
        onChangeText={(text) => handleInputChange('reEmail', text)}
        error={errors.reEmail}
        placeholder="Re-enter your email"
        keyboardType="email-address"
      />

      <FormInput
        label="Phone Number"
        value={formData.number}
        onChangeText={(text) => handleInputChange('number', text)}
        error={errors.number}
        placeholder="Enter your phone number"
        keyboardType="phone-pad"
        maxLength={10}
      />

      <FormInput
        label="Password"
        value={formData.password}
        onChangeText={(text) => handleInputChange('password', text)}
        error={errors.password}
        placeholder="Create a password"
        secureTextEntry
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
          onPress={() => setTermsAccepted(!termsAccepted)}
        >
          <View style={[styles.checkboxInner, termsAccepted && styles.checkboxChecked]} />
        </TouchableOpacity>
        <Text style={styles.termsText}>
          I accept the Terms and Conditions
        </Text>
      </View>
      {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

      <TouchableOpacity
        style={[
          styles.button, 
          (submitting || !termsAccepted) && styles.buttonDisabled
        ]}
        onPress={handleSubmit}
        disabled={submitting || !termsAccepted}
      >
        <Text style={styles.buttonText}>
          {submitting ? 'Registering...' : 'Register'}
        </Text>
      </TouchableOpacity>

    </View>
  );



  return (
    <ScrollView style={styles.container}>
      {renderRegistrationForm()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginVertical: 15,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  pickerContainer: {
    marginBottom: 20,
  },
  datePickerContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
    fontWeight: '500',
  },
  picker: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 5,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 12,
    marginTop: 5,
  },
  button: {
    backgroundColor: '#ff0000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  checkbox: {
    height: 20,
    width: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#666',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    height: 12,
    width: 12,
    borderRadius: 2,
  },
  checkboxChecked: {
    backgroundColor: '#ff0000',
  },
  termsText: {
    fontSize: 14,
    color: '#333',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#0066cc',
    fontSize: 14,
  },
});