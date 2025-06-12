import { View, Text, Image, StyleSheet } from 'react-native'
import React from 'react'
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function LocationErrorScreen({ getLocationInBackground, locationError, openSettings }) {

    let errorMessage = '';
    let buttonText = '';
    let buttonAction = getLocationInBackground;
    let iconSource = `https://res.cloudinary.com/dglihfwse/image/upload/v1744271215/pin_zpnnjn.png`;

    switch (locationError) {
        case ERROR_TYPES.PERMISSION_DENIED:
            errorMessage = 'Location access is required to use this app. Please grant location permissions.';
            buttonText = 'Open Settings';
            buttonAction = openSettings;
            break;

        case ERROR_TYPES.LOCATION_UNAVAILABLE:
            errorMessage = 'Location services are disabled on your device. Please enable location services.';
            buttonText = 'Open Settings';
            buttonAction = openSettings;
            break;

        case ERROR_TYPES.TIMEOUT:
            errorMessage = 'Could not get your location in time. Please check your connection and try again.';
            buttonText = 'Try Again';
            break;

        default:
            errorMessage = 'There was a problem determining your location. Please try again.';
            buttonText = 'Try Again';
    }

    return (


        <View style={styles.errorContainer}>
            <StatusBar style="auto" />
            <Image
                source={{ uri: iconSource }}
                style={styles.errorIcon}
                resizeMode="contain"
            />
            <Text style={styles.errorTitle}>Location Required</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
                style={styles.actionButton}
                onPress={buttonAction}
            >
                <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
        </View>

    )
}


const styles = StyleSheet.create({

    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 30,
    },
    errorIcon: {
        width: 120,
        height: 120,
        marginBottom: 20,
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ff3b30',
        marginBottom: 10,
    },
    errorText: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    actionButton: {
        backgroundColor: '#00aaa9',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 25,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        marginBottom: 15,
        width: '80%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    errorBanner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 59, 48, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        alignItems: 'center',
    },
    errorBannerText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    }
})