import React, { useEffect } from 'react';
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
import { useGuest } from '../../context/GuestLoginContext';

const PhoneAuthModal = ({
    visible,
    phoneNumber,
    onChangePhone,
    onSubmit,
    onClose,
    isSubmitting
}) => {

    const navigation = useNavigation()
    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [visible]);
    const { handleGuestLogin } = useGuest()

    const loggedAsAGuest = () => {
        handleGuestLogin()
        navigation.navigate('Home')
    }

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
                                style={styles.closeButton}
                                onPress={onClose}
                                disabled={isSubmitting}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Enter Phone Number</Text>
                        </View>

                        <View style={styles.modalContent}>
                        <Text style={styles.modalDescription}>
    You'll receive a code via WhatsApp and SMS to continue.
</Text>


                            <View style={styles.phoneInputContainer}>
                                <View style={styles.countryCode}>
                                    <Text style={styles.countryCodeText}>+91</Text>
                                </View>
                                <TextInput
                                    style={styles.phoneInput}
                                    placeholder="10-digit mobile number"
                                    placeholderTextColor="#999"
                                    keyboardType="phone-pad"
                                    value={phoneNumber}
                                    onChangeText={onChangePhone}
                                    maxLength={10}
                                    editable={!isSubmitting}
                                />
                            </View>
                            <TouchableOpacity style={{ marginBottom: 13 }} onPress={() => [onClose(), navigation.navigate('policyauth')]}>
                                <Text style={styles.termsText}>
                                    By continuing, you agree to our{' '}
                                    <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                                    <Text style={styles.termsLink}>Privacy Policy</Text>
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.submitButton,
                                    (!phoneNumber || phoneNumber.length < 10 || isSubmitting) && styles.disabledButton
                                ]}
                                onPress={onSubmit}
                                disabled={!phoneNumber || phoneNumber.length < 10 || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Send OTP</Text>
                                )}

                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => [onClose(), loggedAsAGuest()]}>
                                <Text style={styles.guestText}>
                                    <Text style={styles.highlightText}>You can continue using the app in Guest Mode without the need to sign up.</Text>
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
        minHeight: 300,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    closeButton: {
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
    modalDescription: {
        fontSize: 12,
        textAlign:'center',
        color: '#666',
        marginBottom: 20,
        lineHeight: 20,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden',
    },
    countryCode: {
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 12,
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#ddd',
    },
    countryCodeText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    phoneInput: {
        flex: 1,
        height: 50,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#333',
    },
    submitButton: {
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
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    termsText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        lineHeight: 18,
    },
    termsLink: {
        color: '#ec363f',
        fontWeight: '500',
    },
    guestText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#333',
    },
    highlightText: {
        fontWeight: 'bold',
        color: '#ec363f',
    }
});

export default PhoneAuthModal;