import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


export const LocationCard = React.memo(({ pickup, dropoff }) => {
    return (
        <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
                <Text style={styles.locationTitle}>Trip Route</Text>
                <TouchableOpacity style={styles.editButton}>
                    <MaterialCommunityIcons name="pencil" size={16} color="#C82333" />
                    <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.locationContent}>
                <View style={styles.locationItem}>
                    <View style={styles.locationDot}>
                        <View style={[styles.dot, styles.greenDot]} />
                        <View style={styles.dotLine} />
                    </View>
                    <View style={styles.locationDetails}>
                        <Text style={styles.locationLabel}>PICKUP</Text>
                        <Text style={styles.locationText}>{pickup}</Text>
                    </View>
                </View>

                <View style={styles.locationItem}>
                    <View style={styles.locationDot}>
                        <View style={[styles.dot, styles.redDot]} />
                    </View>
                    <View style={styles.locationDetails}>
                        <Text style={styles.locationLabel}>DROP-OFF</Text>
                        <Text style={styles.locationText}>{dropoff}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    locationCard: {
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
    locationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    editText: {
        marginLeft: 4,
        color: '#C82333',
        fontWeight: '500',
    },
    locationContent: {
        gap: 16,
    },
    locationItem: {
        flexDirection: 'row',
    },
    locationDot: {
        width: 24,
        alignItems: 'center',
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    greenDot: {
        backgroundColor: '#10B981',
    },
    redDot: {
        backgroundColor: '#EF4444',
    },
    dotLine: {
        width: 2,
        height: 30,
        backgroundColor: '#E5E7EB',
        marginVertical: 4,
        marginLeft: 5,
    },
    locationDetails: {
        flex: 1,
        marginLeft: 12,
    },
    locationLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    locationText: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
});