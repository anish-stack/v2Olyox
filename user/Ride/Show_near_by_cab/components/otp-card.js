import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


export const OtpCard = React.memo(({ otp }) => {
    return (
        <View style={styles.otpCard}>
            <View style={styles.otpContent}>
                <View>
                    <Text style={styles.rideStatus}>Ride Confirmed</Text>
                    <Text style={styles.otpLabel}>Share OTP with driver</Text>
                    <Text style={styles.otpNumber}>{otp}</Text>
                </View>
                <View style={styles.otpIconContainer}>
                    <MaterialCommunityIcons name="shield-check" size={32} color="#C82333" />
                </View>
            </View>
            <Text style={styles.otpHint}>Show this code to your driver</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    otpCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    otpContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rideStatus: {
        fontSize: 16,
        fontWeight: '600',
        color: '#10B981',
        marginBottom: 4,
    },
    otpLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    otpNumber: {
        fontSize: 32,
        fontWeight: '700',
        color: '#C82333',
        letterSpacing: 8,
    },
    otpIconContainer: {
        width: 48,
        height: 48,
        backgroundColor: '#EEF2FF',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    otpHint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 12,
        textAlign: 'center',
    },
});