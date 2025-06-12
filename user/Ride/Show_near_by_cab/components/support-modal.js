import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    Dimensions,
    Linking,
    Share,
    Alert,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import useSettings from '../../../hooks/Settings';
import { COLORS } from '../../../constants/colors';

const { height } = Dimensions.get('window');


export const SupportModal = React.memo(({
    visible,
    handleEndRide,
    rideStart=false,
    rideLoadingEnd,
    setVisible,
    driverData,
    rideDetails,
    currentLocation,
    setCancelModel
}) => {

    const { settings } = useSettings()

    // Call emergency services
    const callEmergency = (type) => {
        let phoneNumber = '';

        switch (type) {
            case 'police':
                phoneNumber = '100';
                break;
            case 'ambulance':
                phoneNumber = '108';
                break;
            case 'support':
                phoneNumber = settings?.support_number || "7217619794"; // Replace with actual support number
                break;
            default:
                phoneNumber = '112'; // General emergency
        }

        Linking.openURL(`tel:${phoneNumber}`);
        setVisible(false);
    };

    // Share current location
    const shareLocation = async () => {
        try {
            if (!currentLocation) {
                Alert.alert('Location not available', 'Please wait while we get your location.');
                return;
            }

            const locationUrl = `https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`;
            const message = `I'm currently on my way in a ride. Track my location here: ${locationUrl}`;

            await Share.share({
                message,
                title: 'My Current Location',
            });
        } catch (error) {
            console.error('Error sharing location:', error);
            Alert.alert('Error', 'Failed to share location.');
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={() => setVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Emergency Support</Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setVisible(false)}
                        >
                            <MaterialCommunityIcons name="close" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.emergencyOptions}>
                        <TouchableOpacity
                            style={styles.emergencyOption}
                            onPress={() => callEmergency('police')}
                        >
                            <View style={[styles.emergencyIconContainer, { backgroundColor: '#3B82F6' }]}>
                                <MaterialCommunityIcons name="police-badge" size={28} color="#fff" />
                            </View>
                            <Text style={styles.emergencyText}>Call Police</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.emergencyOption}
                            onPress={() => callEmergency('ambulance')}
                        >
                            <View style={[styles.emergencyIconContainer, { backgroundColor: '#EF4444' }]}>
                                <FontAwesome5 name="ambulance" size={28} color="#fff" />
                            </View>
                            <Text style={styles.emergencyText}>Call Ambulance</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.emergencyOption}
                            onPress={() => callEmergency('support')}
                        >
                            <View style={[styles.emergencyIconContainer, { backgroundColor: '#10B981' }]}>
                                <MaterialCommunityIcons name="headphones" size={28} color="#fff" />
                            </View>
                            <Text style={styles.emergencyText}>Call Support</Text>
                        </TouchableOpacity>


                        {!rideStart && (
                            <TouchableOpacity
                                style={styles.emergencyOption}
                                onPress={() => {
                                    setVisible(false);
                                    setCancelModel(true);
                                }}
                            >
                                <View style={[styles.emergencyIconContainer, { backgroundColor: '#EF4444' }]}>
                                    <MaterialCommunityIcons name="close" size={28} color="#fff" />
                                </View>
                                <Text style={styles.emergencyText}>Cancel Ride</Text>
                            </TouchableOpacity>
                        )}

                    </View>

                    <TouchableOpacity
                        style={styles.shareLocationButton}
                        onPress={shareLocation}
                    >
                        <MaterialCommunityIcons name="share-variant" size={20} color="#fff" />
                        <Text style={styles.shareLocationText}>Share My Location</Text>
                    </TouchableOpacity>

                    <View style={styles.rideInfoContainer}>
                        <Text style={styles.rideInfoTitle}>Ride Information</Text>
                        <View style={styles.rideInfoItem}>
                            <Text style={styles.rideInfoLabel}>Driver:</Text>
                            <Text style={styles.rideInfoValue}>{driverData?.name || 'Driver Name'}</Text>
                        </View>
                        <View style={styles.rideInfoItem}>
                            <Text style={styles.rideInfoLabel}>Vehicle:</Text>
                            <Text style={styles.rideInfoValue}>
                                {driverData?.rideVehicleInfo?.vehicleName || 'Vehicle'} • {driverData?.rideVehicleInfo?.VehicleNumber || 'XX-XX-XXXX'}
                            </Text>
                        </View>
                        <View style={styles.rideInfoItem}>
                            <Text style={styles.rideInfoLabel}>Pickup:</Text>
                            <Text style={styles.rideInfoValue}>{rideDetails.pickup}</Text>
                        </View>
                        <View style={styles.rideInfoItem}>
                            <Text style={styles.rideInfoLabel}>Dropoff:</Text>
                            <Text style={styles.rideInfoValue}>{rideDetails.dropoff}</Text>
                        </View>
                    </View>
                    {rideStart && (
                        <TouchableOpacity
                            style={[styles.shareLocationButton, { backgroundColor: COLORS.error }]}
                            onPress={handleEndRide}
                        >
                            <MaterialCommunityIcons name="car" size={20} color="#fff" />
                            <Text style={styles.shareLocationText}> {rideLoadingEnd ? 'Please Wait While We Confirm With Rider ...' : 'Mark Your Ride Complete'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: height * 0.8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emergencyOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    emergencyOption: {
        alignItems: 'center',
        width: '25%',
    },
    emergencyIconContainer: {
        width: 54,
        height: 54,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    emergencyText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
    },
    shareLocationButton: {
        backgroundColor: '#4F46E5',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#4F46E5',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    shareLocationText: {
        marginLeft: 8,
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    rideInfoContainer: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
    },
    rideInfoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    rideInfoItem: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    rideInfoLabel: {
        width: 80,
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    rideInfoValue: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
        fontWeight: '400',
    },
});