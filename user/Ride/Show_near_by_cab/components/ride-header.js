import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


export const RideHeader = React.memo(({ rideStart }) => {
    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>
                {rideStart ? 'Ride in Progress' : 'Ride Confirmed'}
            </Text>
            <View style={styles.headerBadge}>
                <MaterialCommunityIcons 
                    name={rideStart ? "car" : "check-circle"} 
                    size={16} 
                    color={rideStart ? "#3B82F6" : "#10B981"} 
                />
                <Text style={[
                    styles.headerBadgeText,
                    { color: rideStart ? "#3B82F6" : "#10B981" }
                ]}>
                    {rideStart ? 'In Progress' : 'Confirmed'}
                </Text>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    headerBadgeText: {
        marginLeft: 4,
        fontWeight: '600',
        fontSize: 14,
    },
});