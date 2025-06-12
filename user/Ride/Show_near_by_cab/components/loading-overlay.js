import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    ActivityIndicator,
} from 'react-native';



export const LoadingOverlay = React.memo(({ message = 'Please wait...' }) => {
    return (
        <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#C82333" />
            <Text style={styles.loadingText}>{message}</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        color: '#fff',
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
    },
});