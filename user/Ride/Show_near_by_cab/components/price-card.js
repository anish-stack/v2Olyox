import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';



export const PriceCard = React.memo(({ price }) => {
    return (
        <View style={styles.priceCard}>
            <View style={styles.priceHeader}>
                <Text style={styles.priceTitle}>Trip Fare</Text>
                <TouchableOpacity style={styles.fareDetails}>
                    <Text style={styles.fareDetailsText}>View Details</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#C82333" />
                </TouchableOpacity>
            </View>
            <View style={styles.priceContent}>
                <View>
                    <Text style={styles.priceLabel}>Estimated Total</Text>
                    <Text style={styles.priceAmount}>{price}</Text>
                </View>
                <View style={styles.paymentMethod}>
                    <MaterialCommunityIcons name="cash" size={20} color="#10B981" />
                    <Text style={styles.paymentText}>Cash Payment</Text>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    priceCard: {
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
    priceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    priceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    fareDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fareDetailsText: {
        color: '#C82333',
        fontWeight: '500',
    },
    priceContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    priceAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    paymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    paymentText: {
        marginLeft: 8,
        color: '#4B5563',
        fontWeight: '500',
    },
});