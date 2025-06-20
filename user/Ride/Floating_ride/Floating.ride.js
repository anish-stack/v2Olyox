import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function FloatingRide() {
    const navigation = useNavigation();
    const [isRideActive, setIsRideActive] = useState(false);
    const [scaleAnim] = useState(new Animated.Value(0));
    const [rotateAnim] = useState(new Animated.Value(0));

    const fetchRideDetailsFromDb = async () => {
        try {
            const rideId = await AsyncStorage.getItem('rideId');
            console.log("ride id", rideId)
            if (!rideId) {
                console.warn('No ride ID available');
                setIsRideActive(false);
                return;
            }
            const { data } = await axios.get(`http://192.168.1.6:3100/api/v1/rides/find-ride_details?id=${rideId}`);
            if (data?.data?.is_ride_paid === false) {
                // console.log(data)
                setIsRideActive(data.data?.ride_is_started || false);
            } else (
                setIsRideActive(false)
            )
        } catch (error) {
            console.error('Error fetching ride details:', error);
            setIsRideActive(false);
        }
    };

    useEffect(() => {
        fetchRideDetailsFromDb();
        startAnimation();
    }, []);

    const startAnimation = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ),
        ]).start();
    };

    const rotateInterpolate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleButtonPress = () => {
        if (isRideActive) {
            navigation.navigate('RideStarted');
        } else {
            navigation.navigate('BookRide');
        }
    };

    if (!isRideActive) {
        return null
    }

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.floatingButton,
                    {
                        transform: [
                            { scale: scaleAnim },
                            { rotate: rotateInterpolate },
                        ],
                    },
                ]}
            >
                <TouchableOpacity onPress={handleButtonPress}>
                    <LinearGradient
                        colors={isRideActive ? ['#6a11cb', '#2575fc'] : ['#ff416c', '#ff4b2b']}
                        style={styles.buttonInner}
                    >
                        <Text style={styles.buttonText}>
                            Text
                        </Text>
                        <Text style={styles.buttonText}>
                            {isRideActive ? 'Start Ride' : 'Book'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    floatingButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: height * 0.05,
        marginRight: width * 0.05,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    buttonInner: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    lottieAnimation: {
        width: 40,
        height: 40,
    },
});
