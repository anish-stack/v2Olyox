import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    Alert, 
    ActivityIndicator, 
    StyleSheet,
    StatusBar,
    Platform 
} from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export default function ManualUpdateChecker() {
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');
    const [appVersion, setAppVersion] = useState('');
    const [buildVersion, setBuildVersion] = useState('');
    const [updateInfo, setUpdateInfo] = useState(null);

    useEffect(() => {
        initializeAppInfo();
    }, []);

    const initializeAppInfo = () => {
        try {
            // Get app version from multiple sources
            const version = Constants.expoConfig?.version || 
                          Constants.manifest?.version || 
                          Constants.manifest2?.extra?.expoClient?.version || 
                          '1.0.6';
            
            const buildNumber = Constants.expoConfig?.ios?.buildNumber || 
                              Constants.expoConfig?.android?.versionCode || 
                              Constants.manifest?.ios?.buildNumber || 
                              Constants.manifest?.android?.versionCode || 
                              '39';

            setAppVersion(version);
            setBuildVersion(buildNumber.toString());
        } catch (err) {
            console.warn('Failed to get app version:', err);
            setAppVersion('Unknown');
            setBuildVersion('Unknown');
        }
    };

    const checkForOTAUpdates = async () => {
        // Check if updates are enabled
        if (!Updates.isEnabled) {
            Alert.alert(
                "Updates Disabled", 
                "OTA updates are not enabled for this app configuration."
            );
            return;
        }

        setChecking(true);
        setError('');
        setUpdateAvailable(false);
        setUpdateInfo(null);

        try {
            console.log('Checking for updates...');
            const update = await Updates.checkForUpdateAsync();
            
            console.log('Update check result:', update);

            if (update.isAvailable) {
                setUpdateAvailable(true);
                setUpdateInfo(update);
                
                Alert.alert(
                    "🎉 Update Available!", 
                    `A new version of the app is available.\n\nCurrent: ${appVersion}\nAvailable: ${update.manifest?.version || 'New Version'}\n\nWould you like to download and install it now?`,
                    [
                        {
                            text: "Later",
                            style: "cancel"
                        },
                        {
                            text: "Update Now",
                            onPress: handleUpdateNow
                        }
                    ]
                );
            } else {
                setUpdateAvailable(false);
                Alert.alert(
                    "✅ Up to Date", 
                    `Your app is already running the latest version (${appVersion}).`
                );
            }
        } catch (err) {
            console.error("Update check failed:", err);
            
            let errorMessage = "Failed to check for updates.";
            
            // Provide more specific error messages
            if (err.message?.includes('network')) {
                errorMessage = "Network error. Please check your internet connection.";
            } else if (err.message?.includes('manifest')) {
                errorMessage = "Unable to fetch update information. Please try again later.";
            } else if (err.code === 'ERR_UPDATES_DISABLED') {
                errorMessage = "Updates are disabled for this app.";
            } else if (err.code === 'ERR_UPDATES_NOT_ENABLED') {
                errorMessage = "OTA updates are not configured for this app.";
            }
            
            setError(errorMessage);
            Alert.alert("❌ Update Check Failed", errorMessage);
        } finally {
            setChecking(false);
        }
    };

    const handleUpdateNow = async () => {
        setIsUpdating(true);
        setError('');
        
        try {
            console.log('Starting update download...');
            
            // Show progress to user
            Alert.alert(
                "Downloading Update", 
                "Please wait while the update is being downloaded...",
                [],
                { cancelable: false }
            );
            
            await Updates.fetchUpdateAsync();
            
            console.log('Update downloaded successfully');
            
            Alert.alert(
                "✅ Update Ready", 
                "The update has been downloaded and is ready to install. The app will restart now.",
                [
                    {
                        text: "Restart Now",
                        onPress: async () => {
                            try {
                                await Updates.reloadAsync();
                            } catch (reloadError) {
                                console.error('Reload failed:', reloadError);
                                Alert.alert(
                                    "Restart Required", 
                                    "Please close and reopen the app to apply the update."
                                );
                            }
                        },
                    },
                ],
                { cancelable: false }
            );
        } catch (error) {
            console.error("Update fetch failed:", error);
            
            let errorMessage = "Something went wrong while downloading the update.";
            
            if (error.message?.includes('network')) {
                errorMessage = "Network error during download. Please check your connection and try again.";
            } else if (error.message?.includes('storage')) {
                errorMessage = "Not enough storage space to download the update.";
            }
            
            setError(errorMessage);
            Alert.alert("❌ Update Failed", errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    const renderUpdateButton = () => {
        if (checking) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007BFF" />
                    <Text style={styles.loadingText}>Checking for updates...</Text>
                </View>
            );
        }

        return (
            <TouchableOpacity 
                style={styles.checkButton} 
                onPress={checkForOTAUpdates}
                activeOpacity={0.8}
            >
                <Text style={styles.checkButtonText}>🔍 Check for Updates</Text>
            </TouchableOpacity>
        );
    };

    const renderUpdateAvailable = () => {
        if (!updateAvailable || isUpdating) return null;

        return (
            <View style={styles.updateAvailableContainer}>
                <Text style={styles.updateAvailableText}>
                    🎉 New update available!
                </Text>
                <TouchableOpacity 
                    style={styles.updateButton} 
                    onPress={handleUpdateNow}
                    activeOpacity={0.8}
                >
                    <Text style={styles.updateButtonText}>⬇️ Install Update</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderUpdatingStatus = () => {
        if (!isUpdating) return null;

        return (
            <View style={styles.updatingContainer}>
                <ActivityIndicator size="large" color="#28a745" />
                <Text style={styles.updatingText}>
                    🔄 Downloading and preparing update...
                </Text>
                <Text style={styles.updatingSubtext}>
                    Please keep the app open
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
            
            <View style={styles.header}>
                <Text style={styles.appName}>Olyox</Text>
                <Text style={styles.subtitle}>Update Manager</Text>
            </View>

            <View style={styles.versionContainer}>
                <View style={styles.versionRow}>
                    <Text style={styles.versionLabel}>App Version:</Text>
                    <Text style={styles.versionValue}>{appVersion}</Text>
                </View>
                <View style={styles.versionRow}>
                    <Text style={styles.versionLabel}>Build:</Text>
                    <Text style={styles.versionValue}>{buildVersion}</Text>
                </View>
                <View style={styles.versionRow}>
                    <Text style={styles.versionLabel}>Platform:</Text>
                    <Text style={styles.versionValue}>{Platform.OS}</Text>
                </View>
            </View>

            {renderUpdateButton()}
            {renderUpdateAvailable()}
            {renderUpdatingStatus()}

            {error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>❌ {error}</Text>
                </View>
            ) : null}

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Pull down to refresh or tap "Check for Updates"
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#7f8c8d',
        fontWeight: '500',
    },
    versionContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    versionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    versionLabel: {
        fontSize: 16,
        color: '#7f8c8d',
        fontWeight: '500',
    },
    versionValue: {
        fontSize: 16,
        color: '#2c3e50',
        fontWeight: '600',
    },
    checkButton: {
        backgroundColor: '#007BFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#007BFF',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 3.84,
        elevation: 5,
    },
    checkButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#007BFF',
        fontWeight: '500',
    },
    updateAvailableContainer: {
        backgroundColor: '#d4edda',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#28a745',
    },
    updateAvailableText: {
        fontSize: 16,
        color: '#155724',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 15,
    },
    updateButton: {
        backgroundColor: '#28a745',
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
    },
    updateButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    updatingContainer: {
        alignItems: 'center',
        backgroundColor: '#fff3cd',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#ffc107',
    },
    updatingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#856404',
        fontWeight: '600',
        textAlign: 'center',
    },
    updatingSubtext: {
        marginTop: 5,
        fontSize: 14,
        color: '#856404',
        textAlign: 'center',
    },
    errorContainer: {
        backgroundColor: '#f8d7da',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#dc3545',
    },
    errorText: {
        color: '#721c24',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    footer: {
        alignItems: 'center',
        marginTop: 'auto',
        paddingBottom: 30,
    },
    footerText: {
        fontSize: 14,
        color: '#95a5a6',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});