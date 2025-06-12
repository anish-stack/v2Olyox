import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text,ActivityIndicator, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Layout from '../../components/Layout/_layout';
import { findHotelsDetailsAndList } from '../utils/Hotel.data';
import HotelHeader from './HotelHeader';
import HotelAmenities from './HotelAmenities';
import RoomList from './RoomList';

export default function Hotels_details() {
    const route = useRoute();
    const navigation = useNavigation();
    const { item } = route.params || {};
    const [hotelData, setHotelData] = useState(null);
    const [hotelListing, setHotelListing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            const data = await findHotelsDetailsAndList(item);
            if (data.Hotel_User && data.data.length > 0) {
                setHotelData(data.Hotel_User);
                setHotelListing(data.data);
                setError(null);
            } else {
                setError('No hotel data found');
            }
        } catch (error) {
            setError('Failed to fetch hotel details');
            console.log(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(false);
    };

    useEffect(() => {
        fetchData();
    }, [item]);

    if (loading) {
        return (
            <Layout>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#E41D57" />
                </View>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </Layout>
        );
    }

    return (
        <Layout>
            <ScrollView
                style={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#E41D57']}
                    />
                }
            >
                <HotelHeader hotel={hotelData} />
                <View style={styles.divider} />
                <HotelAmenities amenities={hotelData.amenities} />
                <View style={styles.divider} />
                <RoomList rooms={hotelListing} />
            </ScrollView>
        </Layout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        height: 8,
        backgroundColor: '#f5f5f5',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#E41D57',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});