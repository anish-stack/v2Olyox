import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import styles from './BookingModel.style';
import axios from 'axios';
import { tokenCache } from '../../Auth/cache';
import { useEffect } from 'react';
import GuestCounterIos from './GuestCounterIos';

export default function BookingModal({ visible, onClose, roomData }) {
  const [checkInDate, setCheckInDate] = useState(new Date());
  const [checkOutDate, setCheckOutDate] = useState(new Date(new Date().setDate(new Date().getDate() + 1)));
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [males, setMales] = useState(1);
  const [females, setFemales] = useState(0);
  const [children, setChildren] = useState(0);
  const [loading, setLoading] = useState(false);
  const [numberOfRooms, setNumberOfRooms] = useState(1);
  const [step, setStep] = useState(1);
  const [guests, setGuests] = useState([{ guestName: "", guestAge: "", guestPhone: "" }]);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [errors, setErrors] = useState({});
  const [totalAmount, setTotalAmount] = useState('0');

  const navigation = useNavigation();

  const totalGuests = males + females + children;
  const maxAllowedGuests = numberOfRooms * roomData?.allowed_person || 0;
  const isValidGuests = totalGuests <= maxAllowedGuests;

  // Format date to Indian format
  const formatIndianDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  const handleDateChange = (event, selectedDate, type) => {
    if (Platform.OS === 'android') {
      setShowCheckIn(false);
      setShowCheckOut(false);
    }

    if (selectedDate) {
      if (type === 'checkIn') {
        setCheckInDate(selectedDate);

        if (checkOutDate <= selectedDate) {
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          setCheckOutDate(nextDay);
        }
      } else {
        setCheckOutDate(selectedDate);
      }
    }
  };

  const addGuest = () => {
    if (guests.length < maxAllowedGuests) {
      setGuests([...guests, { guestName: "", guestAge: "", guestPhone: "" }]);
    }
  };

  const removeGuest = (index) => {
    const newGuests = [...guests];
    newGuests.splice(index, 1);
    setGuests(newGuests);
  };

  const updateGuest = (index, field, value) => {
    const newGuests = [...guests];
    newGuests[index][field] = value;
    setGuests(newGuests);

    // Clear error when user types
    if (errors[`guest_${index}_${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`guest_${index}_${field}`];
      setErrors(newErrors);
    }
  };

  const validateStep = () => {
    const newErrors = {};

    switch (step) {
      case 1:
        // Validate dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkInDate < today) {
          newErrors.checkInDate = "Check-in date cannot be in the past";
        }

        if (checkOutDate <= checkInDate) {
          newErrors.checkOutDate = "Check-out date must be after check-in date";
        }
        break;

      case 2:
        // Validate guest count
        if (totalGuests === 0) {
          newErrors.guests = "At least one guest is required";
        }

        if (totalGuests > maxAllowedGuests) {
          newErrors.guests = `Maximum ${maxAllowedGuests} guests allowed for ${numberOfRooms} room(s)`;
        }
        break;

      case 3:
        // Validate guest information
        guests.forEach((guest, index) => {
          if (index === 0) {
            // First guest needs all information
            if (!guest.guestName.trim()) {
              newErrors[`guest_${index}_guestName`] = "Name is required";
            }

            if (!guest.guestAge.trim()) {
              newErrors[`guest_${index}_guestAge`] = "Age is required";
            } else if (isNaN(guest.guestAge) || parseInt(guest.guestAge) <= 0) {
              newErrors[`guest_${index}_guestAge`] = "Please enter a valid age";
            }

            if (!guest.guestPhone.trim()) {
              newErrors[`guest_${index}_guestPhone`] = "Phone number is required";
            } else if (!/^[0-9]{10}$/.test(guest.guestPhone.trim())) {
              newErrors[`guest_${index}_guestPhone`] = "Please enter a valid 10-digit phone number";
            }
          } else {
            // Other guests need only name and age
            if (!guest.guestName.trim()) {
              newErrors[`guest_${index}_guestName`] = "Name is required";
            }

            if (!guest.guestAge.trim()) {
              newErrors[`guest_${index}_guestAge`] = "Age is required";
            } else if (isNaN(guest.guestAge) || parseInt(guest.guestAge) <= 0) {
              newErrors[`guest_${index}_guestAge`] = "Please enter a valid age";
            }
          }
        });
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handlePreviousStep = () => {
    setStep(step - 1);
  };

useEffect(()=>{
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const oneDay = 24 * 60 * 60 * 1000;
  const numberOfDays = Math.max(1, Math.round((checkOut - checkIn) / oneDay)); 

  const roomPricePerDay = 999;
  const totalPrice = numberOfDays * roomPricePerDay * numberOfRooms;
  console.log("totalPrice",totalPrice)
  setTotalAmount(totalPrice)
},[guests])

  const handleSubmit = async () => {
    try {
      // Fetch token from cache
      const token = await tokenCache.getToken('auth_token_db');

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again to continue.",
          [{ text: "OK", onPress: () => navigation.navigate("Onboarding") }]
        );
        return;
      }

      // Final validation before submission
      if (!validateStep()) {
        return;
      }



      const dataToBeSend = {
        guestInformation: guests,
        checkInDate,
        numberOfRooms,
        checkOutDate,
        listing_id: roomData?._id,
        hotel_id: roomData?.hotel_user?._id,
        paymentMethod,
        booking_payment_done: false,
        modeOfBooking: "Online",
        males,
        females,
        children,
        totalGuests,
        totalAmount,
        paymentMode: paymentMethod
      };

      setLoading(true);

      // Make API call
      const { data } = await axios.post(
        `http://192.168.1.6:3100/api/v1/hotels/book-room-user`,
        dataToBeSend,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const bookingData = data.booking;

      // Success Alert
      Alert.alert(
        "Booking Confirmed 🎉",
        "Your booking has been successfully confirmed!",
        [{ text: "OK", onPress: () => onClose() }]
      );

      setStep(1);
      navigation.navigate('Booking_hotel_success', {
        data: {
          checkInDate,
          checkOutDate,
          males,
          roomData,
          females,
          children,
          guestInfo: bookingData.guestInformation,
          paymentMethod,
          Bookingid: bookingData.bookingId
        }
      });

    } catch (error) {
      console.error("Booking Error:", error.response?.data || error.message);

      let errorMessage = "Something went wrong. Please try again.";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid booking details. Please check your inputs.";
      }

      Alert.alert("Booking Failed ❌", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Your Stay Dates</Text>

            {errors.checkInDate && (
              <Text style={styles.errorText}>{errors.checkInDate}</Text>
            )}
            {errors.checkOutDate && (
              <Text style={styles.errorText}>{errors.checkOutDate}</Text>
            )}

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowCheckIn(true)}
            >
              <MaterialIcons name="calendar-today" size={24} color="#de423e" />
              <View style={styles.dateTextContainer}>
                <Text style={styles.dateLabel}>Check-in</Text>
                <Text style={styles.dateValue}>
                  {formatIndianDate(checkInDate)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowCheckOut(true)}
            >
              <MaterialIcons name="calendar-today" size={24} color="#de423e" />
              <View style={styles.dateTextContainer}>
                <Text style={styles.dateLabel}>Check-out</Text>
                <Text style={styles.dateValue}>
                  {formatIndianDate(checkOutDate)}
                </Text>
              </View>
            </TouchableOpacity>

            {(showCheckIn || showCheckOut) && Platform.OS === 'ios' && (
              <DateTimePicker
                value={showCheckIn ? checkInDate : checkOutDate}
                mode="date"
                display="spinner"
                onChange={(event, date) =>
                  handleDateChange(
                    event,
                    date,
                    showCheckIn ? 'checkIn' : 'checkOut'
                  )
                }
                minimumDate={new Date()}
              />
            )}

            <View style={styles.stayDurationContainer}>
              <Text style={styles.stayDurationText}>
                Total Stay: {Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))} night(s)
              </Text>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Guest Details</Text>

            {errors.guests && (
              <Text style={styles.errorText}>{errors.guests}</Text>
            )}

            <View style={styles.roomInfoContainer}>
              <Text style={styles.roomInfoText}>
                Room Capacity: {roomData.allowed_person} guests per room
              </Text>
              <Text style={styles.roomInfoText}>
                Your Selection: {numberOfRooms} room(s) - Maximum {maxAllowedGuests} guests
              </Text>
            </View>

            <View style={styles.roomCountContainer}>
              <Text style={styles.roomCountLabel}>Number of Rooms:</Text>
              <View style={styles.roomCountControls}>
                <TouchableOpacity
                  onPress={() => setNumberOfRooms(Math.max(1, numberOfRooms - 1))}
                  style={styles.roomCountButton}
                  disabled={numberOfRooms <= 1}
                >
                  <FontAwesome name="minus" size={16} color="white" />
                </TouchableOpacity>

                <Text style={styles.roomCountValue}>{numberOfRooms}</Text>

                <TouchableOpacity
                  onPress={() => setNumberOfRooms(numberOfRooms + 1)}
                  style={styles.roomCountButton}
                >
                  <FontAwesome name="plus" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {Platform.OS === "android" ? (
               <View style={styles.guestTypeContainer}>
               <View style={styles.guestTypePicker}>
                 <Text style={styles.guestTypeLabel}>Male</Text>
                 <Picker
                   selectedValue={males}
                   style={styles.picker}
                   onValueChange={setMales}
                 >
                   {[...Array(maxAllowedGuests + 1)].map((_, i) => (
                     <Picker.Item
                       key={`male-${i}`}
                       label={i.toString()}
                       value={i}
                     />
                   ))}
                 </Picker>
               </View>
 
               <View style={styles.guestTypePicker}>
                 <Text style={styles.guestTypeLabel}>Female</Text>
                 <Picker
                   selectedValue={females}
                   style={styles.picker}
                   onValueChange={setFemales}
                 >
                   {[...Array(maxAllowedGuests + 1)].map((_, i) => (
                     <Picker.Item
                       key={`female-${i}`}
                       label={i.toString()}
                       value={i}
                     />
                   ))}
                 </Picker>
               </View>
 
               <View style={styles.guestTypePicker}>
                 <Text style={styles.guestTypeLabel}>Children</Text>
                 <Picker
                   selectedValue={children}
                   style={styles.picker}
                   onValueChange={setChildren}
                 >
                   {[...Array(maxAllowedGuests + 1)].map((_, i) => (
                     <Picker.Item
                       key={`child-${i}`}
                       label={i.toString()}
                       value={i}
                     />
                   ))}
                 </Picker>
               </View>
             </View>
            ):(
              <View style={styles.iosGuestContainer}>
        <GuestCounterIos 
          label="Male" 
          count={males} 
          onIncrease={() => males < maxAllowedGuests ? setMales(males + 1) : null}
          onDecrease={() => males > 0 ? setMales(males - 1) : null}
        />
        
        <GuestCounterIos 
          label="Female" 
          count={females} 
          onIncrease={() => females < maxAllowedGuests ? setFemales(females + 1) : null}
          onDecrease={() => females > 0 ? setFemales(females - 1) : null}
        />
        
        <GuestCounterIos 
          label="Children" 
          count={children} 
          onIncrease={() => children < maxAllowedGuests ? setChildren(children + 1) : null}
          onDecrease={() => children > 0 ? setChildren(children - 1) : null}
        />
      </View>
            )}

           

            <View style={styles.guestSummaryContainer}>
              <Text style={styles.guestSummaryText}>
                Total Guests: {totalGuests}
              </Text>
              {!isValidGuests && (
                <Text style={styles.guestSummaryError}>
                  Please add more rooms or reduce the number of guests
                </Text>
              )}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Guest Information</Text>

            <Text style={styles.guestInfoNote}>
              Please provide details for all {totalGuests} guests
            </Text>

            {guests.map((guest, index) => (
              <View key={index} style={styles.guestInfoCard}>
                <View style={styles.guestInfoHeader}>
                  <Text style={styles.guestInfoTitle}>Guest {index + 1}</Text>
                  {index > 0 && (
                    <TouchableOpacity
                      onPress={() => removeGuest(index)}
                      style={styles.removeGuestButton}
                    >
                      <FontAwesome name="trash" size={18} color="#de423e" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.guestInfoField}>
                  <Text style={styles.guestInfoLabel}>Name *</Text>
                  <TextInput
                    style={[
                      styles.guestInfoInput,
                      errors[`guest_${index}_guestName`] && styles.inputError
                    ]}
                    value={guest.guestName}
                    onChangeText={(text) => updateGuest(index, "guestName", text)}
                    placeholder="Full Name"
                  />
                  {errors[`guest_${index}_guestName`] && (
                    <Text style={styles.fieldErrorText}>
                      {errors[`guest_${index}_guestName`]}
                    </Text>
                  )}
                </View>

                <View style={styles.guestInfoField}>
                  <Text style={styles.guestInfoLabel}>Age *</Text>
                  <TextInput
                    style={[
                      styles.guestInfoInput,
                      errors[`guest_${index}_guestAge`] && styles.inputError
                    ]}
                    value={guest.guestAge}
                    onChangeText={(text) => updateGuest(index, "guestAge", text)}
                    placeholder="Age"
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  {errors[`guest_${index}_guestAge`] && (
                    <Text style={styles.fieldErrorText}>
                      {errors[`guest_${index}_guestAge`]}
                    </Text>
                  )}
                </View>

                {index === 0 && (
                  <View style={styles.guestInfoField}>
                    <Text style={styles.guestInfoLabel}>Phone Number *</Text>
                    <TextInput
                      style={[
                        styles.guestInfoInput,
                        errors[`guest_${index}_guestPhone`] && styles.inputError
                      ]}
                      value={guest.guestPhone}
                      onChangeText={(text) => updateGuest(index, "guestPhone", text)}
                      placeholder="10-digit mobile number"
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                    {errors[`guest_${index}_guestPhone`] && (
                      <Text style={styles.fieldErrorText}>
                        {errors[`guest_${index}_guestPhone`]}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}

            {guests.length < totalGuests && (
              <TouchableOpacity
                style={styles.addGuestButton}
                onPress={addGuest}
              >
                <FontAwesome name="plus-circle" size={20} color="#de423e" />
                <Text style={styles.addGuestText}>Add Guest</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Payment Method</Text>

            <View style={styles.bookingSummary}>
              <Text style={styles.bookingSummaryTitle}>Booking Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Check-in:</Text>
                <Text style={styles.summaryValue}>{formatIndianDate(checkInDate)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Check-out:</Text>
                <Text style={styles.summaryValue}>{formatIndianDate(checkOutDate)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Room(s):</Text>
                <Text style={styles.summaryValue}>{numberOfRooms}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Guests:</Text>
                <Text style={styles.summaryValue}>
                  {males} Male, {females} Female, {children} Children
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Guests:</Text>
                <Text style={styles.summaryValue}>{totalGuests}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount:</Text>
                <Text style={styles.summaryValue}>Rs {totalAmount}</Text>
              </View>
            </View>

            <Text style={styles.paymentTitle}>Select Payment Method</Text>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'online' && styles.selectedPayment
              ]}
              onPress={() => setPaymentMethod('online')}
            >
              <FontAwesome
                name="credit-card"
                size={24}
                color={paymentMethod === 'online' ? '#de423e' : '#666'}
              />
              <View style={styles.paymentTextContainer}>
                <Text style={[
                  styles.paymentText,
                  paymentMethod === 'online' && styles.selectedPaymentText
                ]}>
                  Pay Online Now
                </Text>
                <Text style={styles.paymentDescription}>
                  Secure your booking instantly
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'hotel' && styles.selectedPayment
              ]}
              onPress={() => setPaymentMethod('hotel')}
            >
              <FontAwesome
                name="building"
                size={24}
                color={paymentMethod === 'hotel' ? '#de423e' : '#666'}
              />
              <View style={styles.paymentTextContainer}>
                <Text style={[
                  styles.paymentText,
                  paymentMethod === 'hotel' && styles.selectedPaymentText
                ]}>
                  Pay at Hotel
                </Text>
                <Text style={styles.paymentDescription}>
                  Pay when you arrive at the property
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Select Dates';
      case 2: return 'Guest Details';
      case 3: return 'Guest Information';
      case 4: return 'Payment Method';
      default: return '';
    }
  };

  const getStepProgress = () => {
    return (step / 4) * 100;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{getStepTitle()}</Text>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${getStepProgress()}%` }]} />
            </View>
          </View>

          <ScrollView style={styles.modalBody}>
            {renderStepContent()}
          </ScrollView>

          <View style={styles.modalFooter}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handlePreviousStep}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 4 ? (
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  !isValidGuests && step === 2 && styles.disabledButton
                ]}
                onPress={handleNextStep}
                disabled={!isValidGuests && step === 2}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Date Picker for Android */}
      {(showCheckIn || showCheckOut) && Platform.OS === 'android' && (
        <DateTimePicker
          value={showCheckIn ? checkInDate : checkOutDate}
          mode="date"
          display="default"
          onChange={(event, date) =>
            handleDateChange(
              event,
              date,
              showCheckIn ? 'checkIn' : 'checkOut'
            )
          }
          minimumDate={showCheckIn ? new Date() : new Date(checkInDate.getTime() + 86400000)}
        />
      )}
    </Modal>
  );
}