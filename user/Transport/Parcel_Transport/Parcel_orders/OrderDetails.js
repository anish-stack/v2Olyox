'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert,
    Dimensions, SafeAreaView, RefreshControl
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import MapView, { Marker } from "react-native-maps";
import { tokenCache } from '../../../Auth/cache';
import { useSocket } from '../../../context/SocketContext';

const { width, height } = Dimensions.get('window');

export default function OrderDetails() {
    const navigation = useNavigation();
    const route = useRoute();
    const socket = useSocket()
    const { order } = route.params || {}
    const [sorder, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setRefreshing(true);
        const gmail_token = await tokenCache.getToken("auth_token");
        const db_token = await tokenCache.getToken("auth_token_db");
        const token = db_token || gmail_token;

        if (!token) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const response = await axios.get(`http://192.168.1.6:3100/api/v1/parcel/single_my_parcel_user-details?id=${order?._id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            console.log(response.data.data[0])
            setOrder(response.data.data[0]);
        } catch (error) {
            console.log(error)
            setError(error?.response?.data?.message || "Error fetching data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        fetchData();
    }, []);

    const handleCallDriver = () => {
        if (order?.driverId?.phone) {
            Linking.openURL(`tel:${order.driverId.phone}`)
        } else {
            Alert.alert("Error", "Driver's phone number is not available")
        }
    }

    const handleCancelRide = () => {
        Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
            { text: "No", style: "cancel" },
            {
                text: "Yes",
                onPress: async () => {
                    // Implement cancel ride logic here
                    console.log("Ride cancelled")
                    // await AsyncStorage.removeItem("currentOrder")
                    socket.emit('mark_cancel',sorder)

                    // navigation.goBack()
                },
            },
        ])
    }

    const handleSupportRequest = () => {
        // Implement support request logic here
        console.log("Support requested")
        Alert.alert("Support", "A support representative will contact you shortly.")
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : (
                    <>
                        {!sorder?.is_parcel_delivered && (

                            <View style={styles.mapContainer}>
                                <MapView
                                    style={styles.map}
                                    initialRegion={{
                                        latitude: sorder?.pickupGeo?.coordinates[1],
                                        longitude: sorder?.pickupGeo?.coordinates[0],
                                        latitudeDelta: 0.1,
                                        longitudeDelta: 0.1,
                                    }}
                                >
                                    <Marker
                                        coordinate={{
                                            latitude: sorder?.pickupGeo?.coordinates[1],
                                            longitude: sorder?.pickupGeo?.coordinates[0],
                                        }}
                                        title="Pickup"
                                        description={sorder?.pickupLocation}
                                        pinColor="#FF0000"
                                    />
                                    <Marker
                                        coordinate={{
                                            latitude: sorder?.droppOffGeo?.coordinates[1],
                                            longitude: sorder?.droppOffGeo?.coordinates[0],
                                        }}
                                        title="Dropoff"
                                        description={sorder?.dropoffLocation}
                                        pinColor="#8B0000"
                                    />
                                </MapView>
                            </View>
                        )}
                        <View style={styles.infoContainer}>
                            {console.log("order?.is_driver_reached", order?.is_driver_reached)}
                            {sorder?.is_driver_reached === true && !sorder?.is_parcel_delivered && (

                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>Driver Is Reached At Your Location</Text>
                                </View>
                            )}
                            {sorder?.is_parcel_picked === true && !sorder?.is_parcel_delivered && (

                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>Driver Has Picked Your Parcel</Text>
                                </View>
                            )}

                            {sorder?.is_parcel_delivered === true && (

                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>Driver Has Delivered Your Parcel</Text>
                                    <Text style={styles.badgeText}>{new Date(sorder?.is_driver_reached_at_deliver_place_time).toLocaleDateString('en-us')}</Text>
                                </View>
                            )}

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Customer</Text>
                                <Text style={styles.info}>{sorder.customerName}</Text>
                                <Text style={styles.info}>{sorder.customerPhone}</Text>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Driver</Text>
                                <Text style={styles.info}>{sorder.driverId.name}</Text>
                                <Text style={styles.info}>{sorder.driverId.phone}</Text>
                                <Text style={styles.info}>
                                    {sorder.driverId.bikeDetails.make} {sorder.driverId.bikeDetails.model}
                                </Text>
                                <Text style={styles.info}>{sorder.driverId.bikeDetails.licensePlate}</Text>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Parcel</Text>
                                <Text style={styles.info}>
                                    {sorder.parcelDetails.dimensions.length} x {sorder.parcelDetails.dimensions.width} x{" "}
                                    {sorder.parcelDetails.dimensions.height} cm
                                </Text>
                                <Text style={styles.info}>{sorder.parcelDetails.weight} kg</Text>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Trip</Text>
                                <Text style={styles.info}>From: {sorder.pickupLocation}</Text>
                                <Text style={styles.info}>To: {sorder.dropoffLocation}</Text>
                                <Text style={styles.info}>{sorder.totalKm.toFixed(2)} km</Text>
                                <Text style={styles.price}>₹{sorder.price.toFixed(2)}</Text>
                                <View style={styles.statusContainer}>
                                    <Text style={styles.status}>{sorder.status.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
            <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.button} onPress={handleCallDriver}>
                    <Ionicons name="call" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Call Driver</Text>
                </TouchableOpacity>
               {sorder.status === 'cancelled' || sorder.status=== 'delivered ' ? null :(
                 <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancelRide}>
                 <Ionicons name="close-circle" size={24} color="#fff" />
                 <Text style={styles.buttonText}>Cancel Ride</Text>
             </TouchableOpacity>
               ) }
                <TouchableOpacity style={[styles.button, styles.supportButton]} onPress={handleSupportRequest}>
                    <Ionicons name="help-circle" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Support</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 22,
        backgroundColor: "#FFEBEE",
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: "#FFEBEE",
    },
    loadingText: {
        fontSize: 18,
        color: "#D32F2F",
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: "#D32F2F",
        fontSize: 16,
        textAlign: 'center',
    },
    mapContainer: {
        height: height * 0.3,
        marginBottom: 20,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    infoContainer: {
        padding: 15,
    },
    section: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: "#B71C1C",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#D32F2F",
        marginBottom: 10,
    },
    info: {
        fontSize: 16,
        color: "#616161",
        marginBottom: 5,
    },
    price: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#D32F2F",
        marginTop: 5,
    },
    statusContainer: {
        backgroundColor: "#FFCDD2",
        borderRadius: 5,
        padding: 5,
        alignSelf: "flex-start",
        marginTop: 5,
    },
    status: {
        color: "#B71C1C",
        fontWeight: "bold",
    },
    actionButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 15,
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#FFCDD2",
    },
    button: {
        flex: 1,
        backgroundColor: "#D32F2F",
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 5,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: "#B71C1C",
    },
    supportButton: {
        backgroundColor: "#C62828",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 12,
        marginLeft: 5,
    },
    badge: {
        backgroundColor: "#d64444", // Red color for attention
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginBottom: 14,
        borderRadius: 20, // Rounded corners
        alignSelf: "center",
    },
    badgeText: {
        color: "#ffffff", // White text
        fontWeight: "bold",
        fontSize: 14,
        textAlign: "center",
    },
});
