import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Image,
    Animated,
    Alert,
    Platform,
} from 'react-native';
import { CommonActions, useNavigation, useRoute } from "@react-navigation/native";
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSocket } from '../context/SocketContext';
import { BlurView } from 'expo-blur';
import { LocalRideStorage } from '../services/DatabaseService';
import * as Updates from "expo-updates";
import * as Haptics from 'expo-haptics';
import { useRideStatus } from '../context/CheckRideHaveOrNot.context';

const { width } = Dimensions.get('window');
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function MoneyPage() {
    // Hooks and State
    const navigation = useNavigation();
    const route = useRoute();
    const { socket } = useSocket();
    const { data } = route.params || {};
    const { updateRideStatus} = useRideStatus()

    const [state, setState] = useState({
        userData: null,
        loading: false,
        isRideRate: false,
        rateValue: 0,
        isLoading: false,
        showConfirmation: false,
        paymentMethod: 'cash',
        error: null,
    });

    // Animation values
    const [animations] = useState({
        fade: new Animated.Value(0),
        scale: new Animated.Value(0.9),
        shake: new Animated.Value(0),
    });

    const price = data?.rideDetails?.price || '0';


    const startEntryAnimation = useCallback(() => {
        Animated.parallel([
            Animated.timing(animations.fade, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(animations.scale, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const shakeAnimation = useCallback(() => {
        Animated.sequence([
            Animated.timing(animations.shake, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(animations.shake, {
                toValue: -10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(animations.shake, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // API Functions
    const fetchUserDetails = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const token = await SecureStore.getItemAsync('auth_token_cab');
            if (!token) throw new Error('Authentication token not found');

            const response = await axios.get(
                'https://appapi.olyox.com/api/v1/rider/user-details',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setState(prev => ({ ...prev, userData: response.data.partner }));
        } catch (error) {
            const errorMessage = error?.response?.data?.message || error.message;
            setState(prev => ({ ...prev, error: errorMessage }));
            showErrorAlert('Failed to fetch user details', errorMessage);
        } finally {
            setState(prev => ({ ...prev, loading: false }));
        }
    }, []);

    // Helper Functions
    const showErrorAlert = useCallback((title, message, fnc) => {
        Alert.alert(
            title,
            message,
            [
                { text: 'OK', onPress: () => fnc?.(), style: 'default' }
            ]
        );
    }, []);


    const triggerHapticFeedback = useCallback(() => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, []);

    // Payment Handlers
    const handlePaymentConfirmation = useCallback(async () => {
        triggerHapticFeedback();
        Alert.alert(
            'Confirm Payment',
            'Has the payment been completed?',
            [
                {
                    text: 'No',
                    style: 'cancel',
                },
                {
                    text: 'Yes',
                    style: 'default',
                    onPress: handlePaymentComplete,
                },
            ],
            { cancelable: true }
        );
    }, []);

    const handlePaymentComplete = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            // Clear storage
            await Promise.all([
                SecureStore.deleteItemAsync('activeRide'),
                LocalRideStorage.clearRide()
            ]);

            const sendData = { ...data, paymentMethod: state?.paymentMethod };

            // Emit isPay event
            socket.emit('isPay', sendData, (response) => {
                console.log('isPay emit response:', response);
            });


            const waitForError = new Promise((resolve, reject) => {
                socket.once('payment_error', (errorMessage) => {
                    reject(new Error(errorMessage || 'Payment failed'));
                });


                setTimeout(resolve, 2000);
            });

            await waitForError;


            setState(prev => ({ ...prev, isRideRate: true }));
            updateRideStatus(false);
            setTimeout(async () => {
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                    })
                );
            }, 2000);
        } catch (error) {
            const errorMsg =
                typeof error === 'string'
                    ? error
                    : error?.message || JSON.stringify(error);

            async function reload() {
                // await Updates.reloadAsync();
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                    })
                );
            }
            console.error('Payment completion error:', errorMsg);
            showErrorAlert('Payment Error', 'Unable to complete the payment. Kindly collect cash and mark the ride as complete.', reload);
            shakeAnimation();
        } finally {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [data, navigation, socket, state?.paymentMethod]);


    // Rating Handlers
    const handleRating = useCallback((rate) => {
        triggerHapticFeedback();
        setState(prev => ({ ...prev, rateValue: rate }));
        socket.emit('rateRide', { rating: rate });
    }, [socket]);

    // Effects
    useEffect(() => {
        startEntryAnimation();
        fetchUserDetails();

        const ratingListener = (data) => {
            LocalRideStorage.clearRide();
            setState(prev => ({ ...prev, rateValue: data?.rating || 0 }));
        };

        socket.on('rating', ratingListener);
        return () => socket.off('rating', ratingListener);
    }, []);

    // Render Functions
    const renderPaymentMethods = () => (
        <View style={styles.paymentMethodsContainer}>
            <TouchableOpacity
                style={[
                    styles.paymentMethod,
                    state.paymentMethod === 'cash' && styles.paymentMethodSelected
                ]}
                onPress={() => setState(prev => ({ ...prev, paymentMethod: 'cash' }))}
            >
                <MaterialCommunityIcons
                    name="cash"
                    size={24}
                    color={state.paymentMethod === 'cash' ? '#10B981' : '#FFFFFF'}
                />
                <Text style={styles.paymentMethodText}>Cash</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.paymentMethod,
                    state.paymentMethod === 'online' && styles.paymentMethodSelected
                ]}
                onPress={() => setState(prev => ({ ...prev, paymentMethod: 'online' }))}
            >
                <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={24}
                    color={state.paymentMethod === 'online' ? '#10B981' : '#FFFFFF'}
                />
                <Text style={styles.paymentMethodText}>Online</Text>
            </TouchableOpacity>
        </View>
    );

    if (state.isRideRate) {
        return (
            <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.gradientContainer}
            >
                <Animated.View
                    style={[
                        styles.ratingContainer,
                        {
                            opacity: animations.fade,
                            transform: [{ scale: animations.scale }]
                        }
                    ]}
                >
                    <BlurView intensity={80} style={styles.blurContainer}>
                        <MaterialCommunityIcons
                            name="star-circle"
                            size={64}
                            color="#FFD700"
                            style={styles.ratingIcon}
                        />
                        <Text style={styles.ratingTitle}>How was your ride?</Text>
                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => handleRating(star)}
                                    style={styles.starButton}
                                >
                                    <MaterialCommunityIcons
                                        name={star <= state.rateValue ? 'star' : 'star-outline'}
                                        size={44}
                                        color="#FFD700"
                                        style={styles.star}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.ratingSubtitle}>
                            {state.rateValue > 0
                                ? `You rated ${state.rateValue} star${state.rateValue > 1 ? 's' : ''}`
                                : 'Tap to rate'}
                        </Text>
                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => navigation.navigate('Home')}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </BlurView>
                </Animated.View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            style={styles.gradientContainer}
        >
            <Animated.View
                style={[
                    styles.mainContainer,
                    {
                        opacity: animations.fade,
                        transform: [
                            { scale: animations.scale },
                            { translateX: animations.shake }
                        ]
                    }
                ]}
            >
                <BlurView intensity={80} style={styles.blurContainer}>
                    <Text style={styles.title}>Payment Collection</Text>

                    <View style={styles.priceContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <Text style={styles.price}>{price}</Text>
                    </View>

                    {renderPaymentMethods()}

                    {state.paymentMethod === 'online' && state.userData?.YourQrCodeToMakeOnline && (
                        <View style={styles.qrWrapper}>
                            <Image
                                source={{ uri: state.userData.YourQrCodeToMakeOnline }}
                                style={styles.qrCode}
                                onError={() => setState(prev => ({
                                    ...prev,
                                    error: 'Failed to load QR code'
                                }))}
                            />
                        </View>
                    )}

                    <Text style={styles.instructions}>
                        {state.paymentMethod === 'online'
                            ? 'Scan QR code to complete payment'
                            : 'Collect cash payment from customer'}
                    </Text>

                    {state.error && (
                        <Text style={styles.errorText}>{state.error}</Text>
                    )}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.backButton]}
                            onPress={handlePaymentConfirmation}
                            disabled={state.isLoading}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.collectButton]}
                            onPress={handlePaymentConfirmation}
                            disabled={state.isLoading}
                        >
                            {state.isLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Confirm Payment</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainContainer: {
        width: width * 0.9,
        borderRadius: 24,
        overflow: 'hidden',
    },
    blurContainer: {
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 24,
        textAlign: 'center',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 32,
    },
    currencySymbol: {
        fontSize: 24,
        color: '#FFFFFF',
        marginTop: 8,
    },
    price: {
        fontSize: 48,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    paymentMethodsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24,
        width: '100%',
    },
    paymentMethod: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        gap: 8,
    },
    paymentMethodSelected: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    paymentMethodText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    qrWrapper: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 24,
    },
    qrCode: {
        width: width * 0.6,
        height: width * 0.6,
        borderRadius: 8,
    },
    instructions: {
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.9,
    },
    errorText: {
        color: '#FF4444',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    collectButton: {
        backgroundColor: '#10B981',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    ratingContainer: {
        width: width * 0.9,
        borderRadius: 24,
        overflow: 'hidden',
    },
    ratingIcon: {
        marginBottom: 16,
    },
    ratingTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 32,
        textAlign: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 24,
    },
    starButton: {
        padding: 8,
    },
    star: {
        marginHorizontal: 4,
    },
    ratingSubtitle: {
        fontSize: 18,
        color: '#FFFFFF',
        marginBottom: 32,
        opacity: 0.9,
        textAlign: 'center',
    },
    doneButton: {
        backgroundColor: '#10B981',
        paddingVertical: 16,
        paddingHorizontal: 48,
        borderRadius: 12,
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});