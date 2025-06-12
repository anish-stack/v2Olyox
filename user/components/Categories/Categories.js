import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('screen');
const ITEM_WIDTH = (width - 60) / 5;

export default function Categories({refreshing}) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();

    // Memoized fetch function that won't be recreated on re-renders
    const fetchCategories = useCallback(async () => {
        try {
            const response = await axios.get('https://www.webapi.olyox.com/api/v1/categories_get');
            if (response.data.success) {
                let data = response.data.data;

                // Separate Cab Service
                const cabService = data.find(cat => cat.title === 'Cab Service');
                const rest = data.filter(cat => cat.title !== 'Cab Service');

                // Sort others by position (null/undefined pushed last)
                const sorted = rest.sort((a, b) => {
                    if (a.position == null && b.position == null) return 0;
                    if (a.position == null) return 1;
                    if (b.position == null) return -1;
                    return a.position - b.position;
                });

                // Check if any category already at position 1
                const hasPosition1 = data.some(cat => cat.position === 1);

                // If no one has position 1 and Cab Service exists, insert it manually
                if (!hasPosition1 && cabService) {
                    sorted.unshift({ ...cabService, position: 1 });
                } else if (cabService && cabService.position != null) {
                    // Insert cabService where it belongs
                    sorted.push(cabService);
                    sorted.sort((a, b) => {
                        if (a.position == null && b.position == null) return 0;
                        if (a.position == null) return 1;
                        if (b.position == null) return -1;
                        return a.position - b.position;
                    });
                }

                setCategories(sorted);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    }, [refreshing]);


    useEffect(() => {
        fetchCategories();
    }, [refreshing]);

    // Memoized redirect function
    const redirect = useCallback((screen) => {
        if (screen === 'Cab Service') {
            navigation.navigate('Start_Booking_Ride');
        } else if (screen === "Transport") {
            navigation.navigate('Transport');
        }else if (screen === "Parcel") {
            navigation.navigate('Parcel_Booking');
        } else {
            navigation.navigate(screen);
        }
    }, [navigation]);

    // Memoized grid rendering - only updates when categories change
    const categoriesGrid = useMemo(() => {
        return (
            <View style={styles.grid}>
                {categories.map((category) => (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        key={category._id}
                        style={styles.categoryButton}
                        onPress={() => redirect(category.title)}
                    >
                        <View style={styles.imageContainer}>
                            <CategoryImage icon={category?.icon} />
                        </View>
                        <Text numberOfLines={1} style={styles.title}>
                            {category.title}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    }, [categories, redirect]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF5A5F" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {categoriesGrid}
        </View>
    );
}

// Memoized image component to prevent unnecessary re-renders
const CategoryImage = React.memo(({ icon }) => {
    const [imageError, setImageError] = useState(false);

    return (
        <Image
            source={imageError ? require('./no-image.jpeg') : { uri: icon }}
            style={styles.icon}
            onError={() => setImageError(true)}
            resizeMode="contain"
        />
    );
});

const styles = StyleSheet.create({
    container: {
        padding: 16,
        marginBottom: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    categoryButton: {
        width: ITEM_WIDTH,
        borderRadius: 12,
        alignItems: 'center',
    },
    imageContainer: {
        width: 60,
        height: 60,
        backgroundColor: 'rgba(254, 8, 0, 0.2)',
        borderRadius: 52,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    icon: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 11,
        fontWeight: '600',
        color: '#000',
        textAlign: 'center',
    },
});