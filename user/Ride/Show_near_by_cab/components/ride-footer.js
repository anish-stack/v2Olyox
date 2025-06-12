import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


export const RideFooter = React.memo(({
    rideStart,
    handleEndRide,
    setSupportModalVisible
}) => {
    return (
        <View style={styles.footer}>
            {/* {rideStart ? (
                <TouchableOpacity
                    onPress={handleEndRide}
                    style={styles.endRideButton}
                >
                    <MaterialCommunityIcons name="flag-checkered" size={20} color="#fff" />
                    <Text style={styles.endRideButtonText}>End Ride</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={styles.supportButton}
                    onPress={() => setSupportModalVisible(true)}
                >
                    <MaterialCommunityIcons name="headphones" size={20} color="#fff" />
                    <Text style={styles.supportButtonText}>Need Support?</Text>
                </TouchableOpacity>
            )} */}

            <TouchableOpacity
                style={styles.supportButton}
                onPress={() => setSupportModalVisible(true)}
            >
                <MaterialCommunityIcons name="headphones" size={20} color="#fff" />
                <Text style={styles.supportButtonText}>Need Support?</Text>
            </TouchableOpacity>
        </View>
    );
});

const styles = StyleSheet.create({
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    supportButton: {
        backgroundColor: '#C82333',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#C82333',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    supportButtonText: {
        marginLeft: 8,
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    endRideButton: {
        backgroundColor: '#C82333',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#C82333',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    endRideButtonText: {
        marginLeft: 8,
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});