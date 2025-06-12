import { useEffect, useState } from 'react';
import {
    View,
    Text,
    Alert,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import * as Updates from 'expo-updates';

const { width } = Dimensions.get('window');

export default function CheckAppUpdate({ children }) {
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        checkForOTAUpdates();
    }, []);

    const checkForOTAUpdates = async () => {
        try {
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                setShowUpdateModal(true);
            }
        } catch (err) {
            console.log("Update check failed:", err);
        }
    };

    const handleUpdateNow = async () => {
        setIsUpdating(true);
        try {
            await Updates.fetchUpdateAsync();

            Alert.alert(
                "✅ Update Installed",
                "App restart ho raha hai naye features ke saath...",
                [
                    {
                        text: "Restart Now",
                        onPress: async () => {
                            await Updates.reloadAsync();
                        }
                    }
                ]
            );
        } catch (error) {
            setIsUpdating(false);
            Alert.alert("Update Failed", "Kuch galat hua hai. Phir se try karein.");
        }
    };

    const handleUpdateLater = () => {
        setShowUpdateModal(false);
    };

    return (
        <View style={styles.container}>
            {children}

            <Modal
                visible={showUpdateModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowUpdateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Update Icon/Image */}
                        <View style={styles.imageContainer}>
                            <View style={styles.updateIcon}>
                                <Text style={styles.iconText}>🚀</Text>
                            </View>
                        </View>

                        {/* Driver-focused messaging */}
                        <Text style={styles.title}>Remove Background ping Test Ride Shuru Karein!</Text>

                        <Text style={styles.subtitle}>
                            Driver App mein naye features available hain
                        </Text>

                        <View style={styles.featuresContainer}>
                            <View style={styles.featureItem}>
                                <Text style={styles.featureIcon}>⚡</Text>
                                <Text style={styles.featureText}>Faster ride booking</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <Text style={styles.featureIcon}>💰</Text>
                                <Text style={styles.featureText}>Better earning tracking</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <Text style={styles.featureIcon}>🗺️</Text>
                                <Text style={styles.featureText}>Improved navigation</Text>
                            </View>
                        </View>

                        <Text style={styles.description}>
                            Apne earnings badhane ke liye aur better driving experience ke liye
                            app ko abhi update karein!
                        </Text>

                        {/* Action Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.updateButton}
                                onPress={handleUpdateNow}
                                disabled={isUpdating}
                            >
                                {isUpdating ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator color="#fff" size="small" />
                                        <Text style={styles.updateButtonText}>Updating...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.updateButtonText}>Update Now 🚀</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.laterButton}
                                onPress={handleUpdateLater}
                                disabled={isUpdating}
                            >
                                <Text style={styles.laterButtonText}>Maybe Later</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Driver motivation */}
                        <Text style={styles.motivationText}>
                            "Better app = More rides = More earnings! 💪"
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        width: width * 0.9,
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    imageContainer: {
        marginBottom: 20,
    },
    updateIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    iconText: {
        fontSize: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2E7D32',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },
    featuresContainer: {
        width: '100%',
        marginBottom: 20,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 10,
    },
    featureIcon: {
        fontSize: 20,
        marginRight: 12,
        width: 30,
    },
    featureText: {
        fontSize: 14,
        color: '#444',
        flex: 1,
    },
    description: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 25,
    },
    buttonContainer: {
        width: '100%',
        marginBottom: 15,
    },
    updateButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#4CAF50',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    laterButton: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    laterButtonText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
    },
    motivationText: {
        fontSize: 12,
        color: '#4CAF50',
        fontStyle: 'italic',
        textAlign: 'center',
        fontWeight: '600',
    },
});