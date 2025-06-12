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

export default function OlyoxAppUpdate({ children }) {
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
                "Update Complete",
                "Olyox is restarting with new features...",
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
            Alert.alert("Update Failed", "Something went wrong. Please try again.");
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
                        {/* Minimal Update Icon */}
                        <View style={styles.iconContainer}>
                            <View style={styles.updateIcon}>
                                <Text style={styles.iconText}>↗</Text>
                            </View>
                        </View>

                        {/* Clean Title */}
                        <Text style={styles.title}>Update Available</Text>

                        <Text style={styles.subtitle}>
                            New features are ready for Olyox
                        </Text>

                        {/* Minimal Feature List */}
                        <View style={styles.featuresContainer}>
                            <Text style={styles.featureText}>• Enhanced performance</Text>
                            <Text style={styles.featureText}>• Improved user experience</Text>
                            <Text style={styles.featureText}>• Bug fixes & stability</Text>
                        </View>

                        <Text style={styles.description}>
                            Update now to enjoy the latest improvements and features.
                        </Text>

                        {/* Clean Action Buttons */}
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
                                    <Text style={styles.updateButtonText}>Update Now</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.laterButton}
                                onPress={handleUpdateLater}
                                disabled={isUpdating}
                            >
                                <Text style={styles.laterButtonText}>Later</Text>
                            </TouchableOpacity>
                        </View>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 32,
        width: width * 0.85,
        maxWidth: 380,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
    },
    iconContainer: {
        marginBottom: 24,
    },
    updateIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 32,
        color: '#ffffff',
        fontWeight: '300',
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 24,
        textAlign: 'center',
        fontWeight: '400',
    },
    featuresContainer: {
        width: '100%',
        marginBottom: 24,
        alignItems: 'flex-start',
    },
    featureText: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 8,
        lineHeight: 20,
    },
    description: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    updateButton: {
        backgroundColor: '#DC2626',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        shadowColor: '#DC2626',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    updateButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    laterButton: {
        backgroundColor: 'transparent',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    laterButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
});