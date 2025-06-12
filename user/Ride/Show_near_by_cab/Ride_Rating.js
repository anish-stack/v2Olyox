import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons'; // Make sure to install `expo/vector-icons` or `react-native-vector-icons`
import { COLORS } from '../../constants/colors';
import { useSocket } from '../../context/SocketContext';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function Ride_Rating() {
    const [rating, setRating] = useState(0);
    const navigationD = useNavigation()
    const route = useRoute()
    const { data } = route.params || {};
    const [submitted, setSubmitted] = useState(false);
    const { socket } = useSocket();
    const handleRating = (rate) => {
        if (!submitted) {
            setRating(rate);
        }
    };
    // console.log(data)

    const submitRating = () => {
        setSubmitted(true);
        // Submit the rating to the backend or handle as needed
        if (socket()) {
            socket().emit('rating', { rating: rating, ride: data.rideDetails?.ride });
        }
        navigationD.reset({
            index: 0,
            routes: [{ name: 'Home' }], // Replace 'Home' with the exact route name of your home screen
        });
        console.log(`Submitted Rating: ${rating}`);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Rate Your Ride</Text>
            <Text style={styles.subtitle}>Your feedback helps us improve!</Text>

            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => handleRating(star)}>
                        <FontAwesome
                            name={star <= rating ? 'star' : 'star-o'}
                            size={40}
                            color={COLORS.primary}
                            style={styles.star}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            {submitted ? (
                <Text style={styles.thankYou}>Thank you for your feedback!</Text>
            ) : (
                <TouchableOpacity
                    style={[styles.submitButton, rating === 0 && styles.disabledButton]}
                    onPress={submitRating}
                    disabled={rating === 0}
                >
                    <Text style={styles.buttonText}>Submit Rating</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.secondaryText,
        marginBottom: 30,
        textAlign: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
    },
    star: {
        marginHorizontal: 10,
    },
    submitButton: {
        backgroundColor: COLORS.error,
        paddingVertical: 15,
        paddingHorizontal: 50,
        borderRadius: 10,
        marginTop: 20,
    },
    disabledButton: {
        backgroundColor: COLORS.disabled,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    thankYou: {
        fontSize: 18,
        color: COLORS.success,
        marginTop: 20,
        fontWeight: 'bold',
    },
});
