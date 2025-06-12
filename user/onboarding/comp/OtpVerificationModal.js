// OtpVerificationModal.js
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { createUserRegister } from '../../utils/helpers';

const OtpVerificationModal = ({
  visible,
  otp,
  onChangeOtp,
  onVerify,
  onSubmit,
  onClose,
  phoneNumber,
  isSubmitting,
}) => {
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef(null);
  const Navigation = useNavigation()

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      startTimer();
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [visible]);

  const startTimer = () => {
    setTimer(30);
    setCanResend(false);

    timerRef.current = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (canResend) {
      // Implement resend OTP logic here
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startTimer();
      const formData = { number: phoneNumber };
      const response = await createUserRegister(formData);
      console.log(response)
      // Call your resend API here
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone || phone.length < 10) return phone;
    return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>OTP Verification</Text>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.phoneText}>
                Enter the 6-digit code sent to{'\n'}
                <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber)}</Text> on WhatsApp
              </Text>

              <View style={styles.otpContainer}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={onChangeOtp}
                  maxLength={6}
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                  {canResend ? 'Didn\'t receive the OTP?' : `Resend OTP in ${timer}s`}
                </Text>
                {canResend && (
                  <TouchableOpacity onPress={handleResendOtp}>
                    <Text style={styles.resendButton}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  (!otp || otp.length < 6 || isSubmitting) && styles.disabledButton
                ]}
                onPress={onVerify}
                disabled={!otp || otp.length < 6 || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => [onClose(), Navigation.navigate('Help_me')]}>

                <Text style={styles.helpText}>
                  Having trouble? <Text style={styles.helpLink}>Get Help</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 320,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 15,
  },
  modalContent: {
    padding: 20,
  },
  phoneText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#333',
  },
  otpContainer: {
    marginBottom: 20,
  },
  otpInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    letterSpacing: 5,
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  timerText: {
    fontSize: 14,
    color: '#666',
  },
  resendButton: {
    fontSize: 14,
    color: '#ec363f',
    fontWeight: '600',
    marginLeft: 5,
  },
  verifyButton: {
    backgroundColor: '#ec363f',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#ffb0b5',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  helpLink: {
    color: '#ec363f',
    fontWeight: '500',
  },
});

export default OtpVerificationModal;