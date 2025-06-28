import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export default function ManualCheck() {
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');
    const [appVersion, setAppVersion] = useState('');

    useEffect(() => {
        // Set app version
        const version = Constants?.manifest?.version || '1.0.4';
        setAppVersion(version);
    }, []);

    const checkForOTAUpdates = async () => {
        setChecking(true);
        setError('');
        try {
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                setUpdateAvailable(true);
                Alert.alert("Update Available", "A new update is available. You can update now.");
            } else {
                setUpdateAvailable(false);
                Alert.alert("No Updates", "Your app is up to date.");
            }
        } catch (err) {
            console.log("Update check failed:", err);
            setError("Failed to check for updates.");
        } finally {
            setChecking(false);
        }
    };

    const handleUpdateNow = async () => {
        setIsUpdating(true);
        try {
            await Updates.fetchUpdateAsync();
            Alert.alert(
                "Update Downloaded",
                "Restart the app to apply the update.",
                [
                    {
                        text: "Restart Now",
                        onPress: async () => {
                            await Updates.reloadAsync();
                        },
                    },
                ]
            );
        } catch (error) {
            console.log("Update fetch failed:", error);
            Alert.alert("Update Failed", "Something went wrong while updating.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Olyox Manual Update Checker</Text>
            <Text style={styles.version}>App Version: {appVersion}</Text>

            {checking ? (
                <ActivityIndicator size="large" color="#007BFF" />
            ) : (
                <Button title="Check for Updates" onPress={checkForOTAUpdates} />
            )}

            {updateAvailable && !isUpdating && (
                <View style={styles.updateBtn}>
                    <Button title="Update Now" color="#28a745" onPress={handleUpdateNow} />
                </View>
            )}

            {isUpdating && (
                <Text style={styles.status}>🔄 Downloading and preparing update...</Text>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        marginTop: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    version: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    status: {
        marginTop: 10,
        color: '#007BFF',
        fontWeight: '600',
    },
    error: {
        color: 'red',
        marginTop: 10,
    },
    updateBtn: {
        marginTop: 20,
    },
});
