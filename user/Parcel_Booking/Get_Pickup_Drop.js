import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Keyboard,
    Alert,
    Modal,
    Animated,
    Dimensions,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, X, ChevronLeft, Plus, Home, Store, Heart, Navigation, Clock, Car } from 'lucide-react-native';
import { LocationService } from './services/LocationService';
import { tokenCache } from '../Auth/cache';
import { find_me } from '../utils/helpers';
import { calculateDistance } from './services/distance';
import styles from './styles';

const { height } = Dimensions.get('window');

export default function Get_Pickup_Drop({ navigation }) {
    // Enhanced state management with additional fields
    const [state, setState] = useState({
        locations: {
            pickup: {
                address: '',
                coordinates: { lat: 0, lng: 0 }
            },
            dropoff: {
                address: '',
                coordinates: { lat: 0, lng: 0 }
            },
            stops: []
        },
        apartment: '',
        name: '',
        phone: '',
        vehicle_id: '',
        goodType: '',
        goodId: '',
        useMyNumber: false,
        savedAs: null,
        fares: {
            baseFare: 0,
            netFare: 0,
            couponApplied: false,
            discount: 0,
            payableAmount: 0
        },
        is_rider_assigned: false,
        ride_id: '',
        km_of_ride: '',
        is_booking_completed: false,
        is_booking_cancelled: false,
        is_pickup_complete: false,
        is_dropoff_complete: false,
        ui: {
            suggestions: [],
            loading: false,
            error: null,
            activeInput: null,
            showStops: false,
            loadingDistance: false,

        }
    });

    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [userData, setUserData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [receiverDetails, setReceiverDetails] = useState({
        apartment: '',
        name: '',
        phone: '',
        useMyNumber: false,
        savedAs: null
    });

    const modalAnim = useRef(new Animated.Value(height)).current;
    const inputRefs = useRef({
        pickup: null,
        dropoff: null,
        stops: []
    });
    const debounceTimer = useRef(null);
    const distanceCalculationTimer = useRef(null);

    // Initialize with cached location
    useEffect(() => {
        loadCachedLocation();
        fetchUserData();
    }, []);

    // Show or hide modal with animation
    useEffect(() => {
        if (showModal) {
            Animated.timing(modalAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(modalAnim, {
                toValue: height,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [showModal, modalAnim]);

    // Calculate distance and fare when locations change
    useEffect(() => {
        const { pickup, dropoff } = state.locations;

        // Only calculate if both coordinates are valid
        if (pickup.coordinates.lat && pickup.coordinates.lng &&
            dropoff.coordinates.lat && dropoff.coordinates.lng) {

            if (distanceCalculationTimer.current) {
                clearTimeout(distanceCalculationTimer.current);
            }

            setState(prev => ({
                ...prev,
                ui: { ...prev.ui, loadingDistance: true }
            }));

            distanceCalculationTimer.current = setTimeout(() => {
                calculateRouteDistance();
            }, 500);
        }
    }, [state.locations.pickup.coordinates, state.locations.dropoff.coordinates]);

    const loadCachedLocation = async () => {
        try {
            setState(prev => ({
                ...prev,
                ui: { ...prev.ui, loading: true }
            }));

            const Address = await tokenCache.get_location("cached_location");
            const cachedAddress = JSON.parse(Address);
            const Coords = await tokenCache.get_location("cached_coords");
            const cachedCoords = JSON.parse(Coords);

            if (cachedAddress?.completeAddress) {
                setState(prev => ({
                    ...prev,
                    locations: {
                        ...prev.locations,
                        pickup: {
                            address: cachedAddress.completeAddress,
                            coordinates: {
                                lat: cachedAddress.lat || cachedCoords?.latitude || 0,
                                lng: cachedAddress.lng || cachedCoords?.longitude || 0
                            }
                        }
                    },
                    ui: { ...prev.ui, loading: false }
                }));
            } else {
                setState(prev => ({
                    ...prev,
                    ui: { ...prev.ui, loading: false }
                }));
            }
        } catch (error) {
            console.error("Failed to load cached location:", error);
            setState(prev => ({
                ...prev,
                ui: {
                    ...prev.ui,
                    loading: false,
                    error: "Failed to load your location. Please enter it manually."
                }
            }));
        }
    };

    const fetchUserData = useCallback(async () => {
        try {
            setState(prev => ({
                ...prev,
                ui: { ...prev.ui, loading: true }
            }));

            const user = await find_me();
            setUserData(user.user);

            setState(prev => ({
                ...prev,
                ui: { ...prev.ui, loading: false }
            }));
        } catch (error) {
            console.log("Error fetching user data:", error);
            setState(prev => ({
                ...prev,
                ui: {
                    ...prev.ui,
                    loading: false,
                    error: "Failed to load user data. Please try again."
                }
            }));
        }
    }, []);

    // Calculate route distance using the utility function
    const calculateRouteDistance = async () => {
        try {
            const { pickup, dropoff, stops } = state.locations;

            // Calculate distance between pickup and dropoff
            const distance = await calculateDistance(
                pickup.coordinates,
                dropoff.coordinates,
                stops.map(stop => stop.coordinates)
            );

            const distanceInKm = parseFloat(distance).toFixed(2);

            setState(prev => ({
                ...prev,
                km_of_ride: distanceInKm,

                ui: { ...prev.ui, loadingDistance: false }
            }));
        } catch (error) {
            console.error("Failed to calculate distance:", error);
            setState(prev => ({
                ...prev,
                ui: {
                    ...prev.ui,
                    loadingDistance: false,
                    error: "Failed to calculate distance. Please try again."
                }
            }));
        }
    };

    // Debounced location search
    const searchLocations = useCallback(async (text, inputType) => {
        if (!text || text.length < 2) {
            setState(prev => ({
                ...prev,
                ui: { ...prev.ui, suggestions: [] }
            }));
            return;
        }

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        setState(prev => ({
            ...prev,
            ui: { ...prev.ui, loading: true, activeInput: inputType }
        }));

        debounceTimer.current = setTimeout(async () => {
            try {
                const suggestions = await LocationService.searchLocations(text);
                setState(prev => ({
                    ...prev,
                    ui: {
                        ...prev.ui,
                        suggestions,
                        loading: false
                    }
                }));
            } catch (error) {
                setState(prev => ({
                    ...prev,
                    ui: {
                        ...prev.ui,
                        loading: false,
                        error: 'Failed to fetch suggestions. Please check your connection.'
                    }
                }));

                // Auto-clear error after 3 seconds
                setTimeout(() => {
                    setState(prev => ({
                        ...prev,
                        ui: { ...prev.ui, error: null }
                    }));
                }, 3000);
            }
        }, 300);
    }, []);

    // Handle location selection from suggestions
    const handleLocationSelect = useCallback(async (location) => {
        const activeInput = state.ui.activeInput;

        setState(prev => {
            const newState = {
                ...prev,
                ui: { ...prev.ui, suggestions: [], loading: true }
            };

            // Update the appropriate location field
            if (activeInput === 'pickup') {
                newState.locations.pickup = {
                    ...newState.locations.pickup,
                    address: location
                };
                // Focus next input
                setTimeout(() => inputRefs.current.dropoff?.focus(), 100);
            }
            else if (activeInput === 'dropoff') {
                newState.locations.dropoff = {
                    ...newState.locations.dropoff,
                    address: location
                };
                Keyboard.dismiss();
            }
            else if (activeInput?.startsWith('stop-')) {
                const stopIndex = parseInt(activeInput.split('-')[1], 10);
                const newStops = [...prev.locations.stops];

                if (newStops[stopIndex]) {
                    newStops[stopIndex] = {
                        ...newStops[stopIndex],
                        address: location
                    };
                }

                newState.locations.stops = newStops;

                // Focus next input or dismiss keyboard
                if (stopIndex < newStops.length - 1) {
                    setTimeout(() => inputRefs.current.stops[stopIndex + 1]?.focus(), 100);
                } else {
                    Keyboard.dismiss();
                }
            }

            return newState;
        });

        // Get coordinates for the selected location
        try {
            const coordinates = await LocationService.getCoordinates(location);

            if (coordinates) {
                setState(prev => {
                    const newState = { ...prev };

                    if (activeInput === 'pickup') {
                        newState.locations.pickup.coordinates = {
                            lat: coordinates.latitude,
                            lng: coordinates.longitude
                        };
                    }
                    else if (activeInput === 'dropoff') {
                        newState.locations.dropoff.coordinates = {
                            lat: coordinates.latitude,
                            lng: coordinates.longitude
                        };
                    }
                    else if (activeInput?.startsWith('stop-')) {
                        const stopIndex = parseInt(activeInput.split('-')[1], 10);
                        const newStops = [...prev.locations.stops];

                        if (newStops[stopIndex]) {
                            newStops[stopIndex].coordinates = {
                                lat: coordinates.latitude,
                                lng: coordinates.longitude
                            };
                            newState.locations.stops = newStops;
                        }
                    }

                    newState.ui.loading = false;
                    return newState;
                });
            } else {
                setState(prev => ({
                    ...prev,
                    ui: {
                        ...prev.ui,
                        loading: false,
                        error: "Could not get coordinates for this location."
                    }
                }));
            }
        } catch (error) {
            console.error("Failed to get coordinates:", error);
            setState(prev => ({
                ...prev,
                ui: {
                    ...prev.ui,
                    loading: false,
                    error: "Failed to get coordinates. Please try again."
                }
            }));
        }
    }, [state.ui.activeInput]);

    // Add a new stop
    const addStop = useCallback(() => {
        setState(prev => {
            // Limit to maximum 3 stops
            if (prev.locations.stops.length >= 3) {
                Alert.alert('Maximum Stops', 'You can add a maximum of 3 stops.');
                return prev;
            }

            return {
                ...prev,
                locations: {
                    ...prev.locations,
                    stops: [
                        ...prev.locations.stops,
                        { address: '', coordinates: { lat: 0, lng: 0 } }
                    ]
                },
                ui: {
                    ...prev.ui,
                    showStops: true
                }
            };
        });
    }, []);

    // Remove a stop
    const removeStop = useCallback((index) => {
        setState(prev => ({
            ...prev,
            locations: {
                ...prev.locations,
                stops: prev.locations.stops.filter((_, i) => i !== index)
            }
        }));

        // Recalculate distance after removing a stop
        if (distanceCalculationTimer.current) {
            clearTimeout(distanceCalculationTimer.current);
        }

        distanceCalculationTimer.current = setTimeout(() => {
            calculateRouteDistance();
        }, 500);
    }, []);

    // Handle text input changes
    const handleInputChange = useCallback((text, type, stopIndex = null) => {
        setSelection({ start: text.length, end: text.length });
        setState(prev => {
            const newState = { ...prev };

            if (type === 'pickup') {
                newState.locations.pickup.address = text;
            }
            else if (type === 'dropoff') {
                newState.locations.dropoff.address = text;
            }
            else if (type === 'stop' && stopIndex !== null) {
                const newStops = [...prev.locations.stops];
                if (newStops[stopIndex]) {
                    newStops[stopIndex].address = text;
                    newState.locations.stops = newStops;
                }
            }

            return newState;
        });

        const searchType = type === 'stop' ? `stop-${stopIndex}` : type;
        searchLocations(text, searchType);
    }, [searchLocations]);

    // Handle input focus
    const handleInputFocus = useCallback((inputType) => {
        setState(prev => ({
            ...prev,
            ui: { ...prev.ui, activeInput: inputType }
        }));
    }, []);

    // Handle receiver details changes
    const handleReceiverDetailsChange = (field, value) => {
        setReceiverDetails(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle "Save as" selection
    const handleSaveAsSelection = (type) => {
        setReceiverDetails(prev => ({
            ...prev,
            savedAs: prev.savedAs === type ? null : type
        }));
    };

    const handleUseMyNumber = () => {
        setReceiverDetails(prev => {
            const newState = {
                ...prev,
                useMyNumber: !prev.useMyNumber
            };

            // Extract number from userData
            const userNumber = userData?.user?.number || userData?.number;

            if (newState.useMyNumber) {
                if (userNumber) {
                    newState.phone = userNumber;
                } else {
                    newState.phone = '';
                    console.log("Check Error: user number not found in userData", userData);
                    newState.useMyNumber = false; // rollback toggle since number is not available

                    // Show error to user
                    Alert.alert('Error', 'Could not find your phone number. Please enter it manually.');
                }
            } else {
                newState.phone = '';
            }

            return newState;
        });
    };



    // Handle submit of receiver details
    const handleSubmitDetails = () => {
        const { name, phone, apartment } = receiverDetails;

        // Validate required fields
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter receiver\'s name');
            return;
        }

        if (!phone.trim()) {
            Alert.alert('Error', 'Please enter receiver\'s phone number');
            return;
        }

        // Validate phone number format
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone.trim())) {
            Alert.alert('Error', 'Please enter a valid 10-digit phone number');
            return;
        }

        // Process the complete order information
        const orderDetails = {
            pickup: state.locations.pickup,
            dropoff: state.locations.dropoff,
            stops: state.ui.showStops ? state.locations.stops : [],
            receiver: {
                ...receiverDetails,
                apartment: receiverDetails.apartment || 'Not specified'
            },
            vehicle_id: state.ui.selectedVehicle,
            km_of_ride: state.km_of_ride,
            fares: state.fares,
            ride_id: `RIDE-${Date.now()}`, // Generate a temporary ride ID
            is_rider_assigned: false,
            is_booking_completed: false,
            is_booking_cancelled: false,
            is_pickup_complete: false,
            is_dropoff_complete: false
        };

        console.log('Complete order details:', orderDetails);

        // Navigate to next screen with all details
        navigation.navigate('Choose_Vehicle', { orderDetails });
        setShowModal(false);
    };

    // Memoized suggestion renderer
    const renderSuggestion = useCallback(({ item }) => (
        <TouchableOpacity
            style={styles.suggestionItem}
            onPress={() => handleLocationSelect(item.description)}
        >
            <MapPin size={20} color="#e53935" style={styles.suggestionIcon} />
            <View style={styles.suggestionText}>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                </Text>
                <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text}
                </Text>
            </View>
        </TouchableOpacity>
    ), [handleLocationSelect]);

    // Memoized suggestions list
    const suggestionsList = useMemo(() => (
        <FlatList
            data={state.ui.suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => `suggestion-${index}`}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="always"
        />
    ), [state.ui.suggestions, renderSuggestion]);


    // Check if all required receiver details are filled
    const isDetailsComplete = useMemo(() => {
        const { name, phone } = receiverDetails;
        return name.trim() !== '' && phone.trim() !== '';
    }, [receiverDetails]);

    // Check if both pickup and dropoff are selected
    const isLocationComplete = useMemo(() => {
        const { pickup, dropoff } = state.locations;
        return pickup.address && dropoff.address &&
            pickup.coordinates.lat && pickup.coordinates.lng &&
            dropoff.coordinates.lat && dropoff.coordinates.lng;
    }, [state.locations]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation?.goBack()}
                    style={styles.backButton}
                >
                    <ChevronLeft size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Set Location</Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.locationInputs}>
                    {/* Pickup Input */}
                    <View style={styles.inputWrapper}>
                        <MapPin size={20} color="#4CAF50" />
                        <TextInput
                            ref={el => inputRefs.current.pickup = el}
                            style={styles.input}
                            placeholder="Pickup location"
                            selection={selection}
                            multiline={true}
                            value={state.locations.pickup.address}
                            onChangeText={(text) => handleInputChange(text, 'pickup')}
                            onFocus={() => handleInputFocus('pickup')}
                            autoFocus
                        />
                        {state.locations.pickup.address ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setState(prev => ({
                                        ...prev,
                                        locations: {
                                            ...prev.locations,
                                            pickup: { ...prev.locations.pickup, address: '' }
                                        }
                                    }));
                                }}
                            >
                                <X size={20} color="#999" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Dropoff Input */}
                    <View style={styles.inputWrapper}>
                        <MapPin size={20} color="#e53935" />
                        <TextInput
                            ref={el => inputRefs.current.dropoff = el}
                            style={styles.input}
                            placeholder="Where to?"
                            selection={selection}
                            multiline={true}
                            value={state.locations.dropoff.address}
                            onChangeText={(text) => handleInputChange(text, 'dropoff')}
                            onFocus={() => handleInputFocus('dropoff')}
                        />
                        {state.locations.dropoff.address ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setState(prev => ({
                                        ...prev,
                                        locations: {
                                            ...prev.locations,
                                            dropoff: { ...prev.locations.dropoff, address: '' }
                                        }
                                    }));
                                }}
                            >
                                <X size={20} color="#999" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Stops Inputs */}
                    {state.ui.showStops && state.locations.stops.map((stop, index) => (
                        <View key={`stop-${index}`} style={styles.inputWrapper}>
                            <MapPin size={20} color="#FF9800" />
                            <TextInput
                                ref={el => {
                                    if (!inputRefs.current.stops) {
                                        inputRefs.current.stops = [];
                                    }
                                    inputRefs.current.stops[index] = el;
                                }}
                                style={styles.input}
                                placeholder={`Stop ${index + 1}`}
                                value={stop.address}
                                 multiline={true}
                                onChangeText={(text) => handleInputChange(text, 'stop', index)}
                                onFocus={() => handleInputFocus(`stop-${index}`)}
                            />
                            <TouchableOpacity onPress={() => removeStop(index)}>
                                <X size={20} color="#999" />
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* Add Stop Button */}
                    {/* <TouchableOpacity
                        style={styles.addStopButton}
                        onPress={addStop}
                    >
                        <Plus size={20} color="#e53935" />
                        <Text style={styles.addStopText}>Add Stop</Text>
                    </TouchableOpacity> */}
                </View>

                {/* Loading Indicator */}
                {state.ui.loading && (
                    <ActivityIndicator style={styles.loader} color="#e53935" size="large" />
                )}

                {/* Error Message */}
                {state.ui.error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{state.ui.error}</Text>
                    </View>
                )}

                {/* Suggestions List */}
                {state.ui.suggestions.length > 0 && (
                    suggestionsList
                )}



            </View>

            {/* Continue Button */}

            <View style={styles.continueButtonContainer}>
                <TouchableOpacity
                    style={styles.continueButton}
                    onPress={() => setShowModal(true)}
                >
                    <Text style={styles.continueButtonText}>Continue Booking</Text>
                </TouchableOpacity>
            </View>


            {/* Bottom Modal for Receiver Details */}
            <Modal
                visible={showModal}
                transparent={true}
                animationType="none"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowModal(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : null}
                        style={styles.keyboardAvoid}
                    >
                        <Animated.View
                            style={[
                                styles.modalContainer,
                                { transform: [{ translateY: modalAnim }] }
                            ]}
                        >
                            <View style={styles.modalHandle} />

                            <ScrollView
                                contentContainerStyle={styles.modalContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* Location Display */}
                                <View style={styles.selectedLocation}>
                                    <MapPin size={24} color="#e53935" style={styles.locationIcon} />
                                    <View style={styles.locationTextContainer}>
                                        <Text style={styles.locationTitle}>
                                            {state.locations.dropoff.address.split(',')[0] || 'Selected Location'}
                                        </Text>
                                        <Text style={styles.locationAddress} numberOfLines={1}>
                                            {state.locations.dropoff.address}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.changeButton}
                                        onPress={() => setShowModal(false)}
                                    >
                                        <Text style={styles.changeButtonText}>Change</Text>
                                    </TouchableOpacity>
                                </View>


                                {/* Apartment/House/Shop Input */}
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="House / Apartment / Shop (optional)"
                                    value={receiverDetails.apartment}
                                    onChangeText={(text) => handleReceiverDetailsChange('apartment', text)}
                                />

                                {/* Receiver's Name Input */}
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Receiver's Name"
                                    value={receiverDetails.name}
                                    onChangeText={(text) => handleReceiverDetailsChange('name', text)}
                                />

                                {/* Receiver's Mobile Number Input */}
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Receiver's Mobile number"
                                    value={receiverDetails.phone}
                                    onChangeText={(text) => handleReceiverDetailsChange('phone', text)}
                                    keyboardType="phone-pad"
                                    editable={!receiverDetails.useMyNumber}
                                />

                                {/* Use My Mobile Number Toggle */}
                                <TouchableOpacity
                                    style={styles.checkboxContainer}
                                    onPress={handleUseMyNumber}
                                >
                                    <View style={[
                                        styles.checkbox,
                                        receiverDetails.useMyNumber ? styles.checkboxChecked : {}
                                    ]}>
                                        {receiverDetails.useMyNumber && <Text style={styles.checkmark}>✓</Text>}
                                    </View>
                                    <Text style={styles.checkboxLabel}>
                                        Use my mobile number: {userData?.user?.number || userData?.number || 'Not available'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Save As (Optional) Section */}
                                <Text style={styles.saveAsLabel}>Save as (optional):</Text>
                                <View style={styles.saveAsContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.saveAsOption,
                                            receiverDetails.savedAs === 'home' ? styles.selectedSaveOption : {}
                                        ]}
                                        onPress={() => handleSaveAsSelection('home')}
                                    >
                                        <Home size={20} color={receiverDetails.savedAs === 'home' ? '#e53935' : '#757575'} />
                                        <Text style={[
                                            styles.saveAsText,
                                            receiverDetails.savedAs === 'home' ? styles.selectedSaveText : {}
                                        ]}>Home</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.saveAsOption,
                                            receiverDetails.savedAs === 'shop' ? styles.selectedSaveOption : {}
                                        ]}
                                        onPress={() => handleSaveAsSelection('shop')}
                                    >
                                        <Store size={20} color={receiverDetails.savedAs === 'shop' ? '#e53935' : '#757575'} />
                                        <Text style={[
                                            styles.saveAsText,
                                            receiverDetails.savedAs === 'shop' ? styles.selectedSaveText : {}
                                        ]}>Shop</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.saveAsOption,
                                            receiverDetails.savedAs === 'other' ? styles.selectedSaveOption : {}
                                        ]}
                                        onPress={() => handleSaveAsSelection('other')}
                                    >
                                        <Heart size={20} color={receiverDetails.savedAs === 'other' ? '#e53935' : '#757575'} />
                                        <Text style={[
                                            styles.saveAsText,
                                            receiverDetails.savedAs === 'other' ? styles.selectedSaveText : {}
                                        ]}>Other</Text>
                                    </TouchableOpacity>
                                </View>



                                {/* Enter Contact Details Button */}
                                <TouchableOpacity
                                    style={[
                                        styles.enterDetailsButton,
                                        isDetailsComplete ? styles.enterDetailsButtonActive : {}
                                    ]}
                                    onPress={handleSubmitDetails}
                                    disabled={!isDetailsComplete}
                                >
                                    <Text style={styles.enterDetailsText}>
                                        Confirm Booking
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
