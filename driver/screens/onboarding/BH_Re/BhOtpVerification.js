import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';

const BhOtpVerification = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { type, email, number } = route.params;

    console.log("type",type)

    const [formData, setFormData] = useState({
        otp: '',
        type: "email",
        email: email,
    });
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (timer > 0) setTimer((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [timer]);

    const handleChange = (value) => {
        setFormData({ ...formData, otp: value });
    };

    const handleSubmit = async () => {
        if (!formData.otp || formData.otp.length !== 6) {
            Alert.alert("Error", "Please enter a valid 6-digit OTP");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(
                "https://www.api.olyox.com/api/v1/verify_email",
                formData
            );
            Alert.alert("Success", response.data.message || "OTP verified successfully!", [
                { text: "OK", onPress: () => navigation.navigate('register', { bh: response.data.BHID }) }
            ]);
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to verify OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) {
            Alert.alert("Please wait", `Resend OTP in ${timer} seconds.`);
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(
                "https://webapi.olyox.com/api/v1/resend_Otp",
                { email, type:'email' }
            );
            Alert.alert("Success", response.data.message || "OTP sent successfully!");
            setTimer(120);
        } catch (error) {
            console.log("error.response",error.response)
            Alert.alert("Error", error.response?.data?.message || "Failed to resend OTP.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>We have sent a 6-digit OTP to Whatsapp <Text style={styles.bold}>{number}</Text></Text>

                <TextInput
                    style={styles.input}
                    placeholder="Enter OTP"
                    keyboardType="numeric"
                    maxLength={6}
                    value={formData.otp}
                    onChangeText={handleChange}
                />

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Verify OTP</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={timer > 0 || loading}
                >
                    <Text style={styles.resendText}>
                        {timer > 0 ? `Resend OTP in ${timer}s` : "Didn't receive the OTP? Resend"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF4F4',
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        textAlign: 'center',
        color: '#555',
        marginBottom: 20,
    },
    bold: {
        fontWeight: 'bold',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#D62C27',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resendText: {
        textAlign: 'center',
        color: '#D62C27',
        fontSize: 14,
    },
});

export default BhOtpVerification;
