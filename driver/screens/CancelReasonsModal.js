import React, { useState, useCallback, useRef } from 'react';
import { 
    Modal, 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    StyleSheet,
    Dimensions,
    Animated,
    Alert
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const CancelReasonsModal = ({ appState, updateState, handleCancelRide ,handleClose }) => {
    const [localSelectedReason, setLocalSelectedReason] = useState(appState.selectedReason);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // console.log(appState.showCancelModal)
    // Animation for smooth transitions
    const animateSelection = useCallback(() => {
        Animated.spring(slideAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true
        }).start();
    }, [slideAnim]);

    const handleReasonSelect = useCallback((reasonId) => {
        console.log('Reason selected:', reasonId);
        setLocalSelectedReason(reasonId);
        updateState({ selectedReason: reasonId });
        animateSelection();
    }, [updateState, animateSelection]);

    const handleCloseModal = useCallback(() => {
        // Animate out
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            handleClose()
            setLocalSelectedReason(null);
            setShowConfirmation(false);
            // Reset animations
            slideAnim.setValue(0);
            fadeAnim.setValue(1);
        });
    }, [updateState, fadeAnim, slideAnim]);

    const handleConfirmCancel = useCallback(() => {
        if (localSelectedReason) {
            setShowConfirmation(true);
        }
    }, [localSelectedReason]);

    const processCancelRide = useCallback(() => {
        if (localSelectedReason) {
            const selectedReasonData = appState.cancelReasons.find(
                reason => reason._id === localSelectedReason
            );
            console.log('Canceling ride with reason:', selectedReasonData);
            handleCancelRide(selectedReasonData);
            
            // Show success message before closing
            Alert.alert(
                "Ride Cancelled",
                "The captain has been notified about your cancellation.",
                [{ text: "OK", onPress: handleCloseModal }]
            );
        }
    }, [localSelectedReason, appState.cancelReasons, handleCancelRide, handleCloseModal]);

    if (!appState.showCancelModal) {
        return null;
    }

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={appState.showCancelModal}
            onRequestClose={handleCloseModal}
            statusBarTranslucent={true}
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <Animated.View 
                    style={[
                        styles.modalContainer,
                        { transform: [{ scale: fadeAnim }] }
                    ]}
                >
                    {!showConfirmation ? (
                        <>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>Cancel Ride</Text>
                                <TouchableOpacity
                                    onPress={() => handleCloseModal()}
                                    style={styles.closeButton}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons 
                                        name="close" 
                                        size={24} 
                                        color="#666" 
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Subtitle */}
                            <Text style={styles.subtitle}>
                                Please select a reason for canceling your ride
                            </Text>

                            {/* Reasons List */}
                            <ScrollView 
                                style={styles.scrollView}
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                contentContainerStyle={styles.scrollViewContent}
                            >
                                {appState.cancelReasons && appState.cancelReasons.length > 0 ? (
                                    appState.cancelReasons.map((reason, index) => {
                                        const isSelected = localSelectedReason === reason._id;
                                        
                                        return (
                                            <Animated.View
                                                key={`${reason._id}-${index}`}
                                                style={[
                                                    { transform: [{ scale: isSelected ? slideAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [1, 1.02]
                                                    }) : 1 }] }
                                                ]}
                                            >
                                                <TouchableOpacity
                                                    style={[
                                                        styles.reasonItem,
                                                        isSelected && styles.reasonItemSelected
                                                    ]}
                                                    onPress={() => handleReasonSelect(reason._id)}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={styles.reasonContent}>
                                                        <View style={styles.reasonTextContainer}>
                                                            <Text style={[
                                                                styles.reasonTitle,
                                                                isSelected && styles.reasonTitleSelected
                                                            ]}>
                                                                {reason.name}
                                                            </Text>
                                                            <Text style={[
                                                                styles.reasonDescription,
                                                                isSelected && styles.reasonDescriptionSelected
                                                            ]}>
                                                                {reason.description}
                                                            </Text>
                                                        </View>
                                                        
                                                        <View style={styles.checkContainer}>
                                                            {isSelected ? (
                                                                <Animated.View 
                                                                    style={[
                                                                        styles.selectedIndicator,
                                                                        { transform: [{ scale: slideAnim }] }
                                                                    ]}
                                                                >
                                                                    <MaterialCommunityIcons 
                                                                        name="check-circle" 
                                                                        size={24} 
                                                                        color="#FF3B30" 
                                                                    />
                                                                </Animated.View>
                                                            ) : (
                                                                <View style={styles.unselectedIndicator} />
                                                            )}
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            </Animated.View>
                                        );
                                    })
                                ) : (
                                    <View style={styles.noReasonsContainer}>
                                        <MaterialCommunityIcons 
                                            name="alert-circle-outline" 
                                            size={48} 
                                            color="#999" 
                                        />
                                        <Text style={styles.noReasonsText}>
                                            No cancel reasons available
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>

                            {/* Action Buttons */}
                            <View style={styles.actionContainer}>
                                <TouchableOpacity
                                    style={styles.backButton}
                                    onPress={handleCloseModal}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.backButtonText}>Back</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    style={[
                                        styles.cancelButton,
                                        !localSelectedReason && styles.cancelButtonDisabled
                                    ]}
                                    onPress={handleConfirmCancel}
                                    disabled={!localSelectedReason}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons 
                                        name="close-circle" 
                                        size={20} 
                                        color="#fff" 
                                        style={styles.cancelButtonIcon}
                                    />
                                    <Text style={styles.cancelButtonText}>
                                        Cancel Ride
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        // Confirmation Screen
                        <View style={styles.confirmationContainer}>
                            <View style={styles.confirmationIconContainer}>
                                <MaterialCommunityIcons 
                                    name="alert-circle" 
                                    size={64} 
                                    color="#FF3B30" 
                                />
                            </View>
                            
                            <Text style={styles.confirmationTitle}>
                                Are you sure?
                            </Text>
                            
                            <Text style={styles.confirmationText}>
                                This will cancel your current ride and notify the user.
                                Frequent cancellations may affect your account.
                            </Text>
                            
                            <View style={styles.confirmationButtons}>
                                <TouchableOpacity
                                    style={styles.goBackButton}
                                    onPress={() => setShowConfirmation(false)}
                                >
                                    <Text style={styles.goBackButtonText}>
                                        Go Back
                                    </Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    style={styles.confirmCancelButton}
                                    onPress={processCancelRide}
                                >
                                    <Text style={styles.confirmCancelButtonText}>
                                        Yes, Cancel Ride
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 20,
        maxHeight: height * 0.8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    closeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        paddingHorizontal: 24,
        paddingBottom: 16,
        lineHeight: 22,
    },
    scrollView: {
        maxHeight: 350,
    },
    scrollViewContent: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    reasonItem: {
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e0e0e0',
        backgroundColor: '#fafafa',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    reasonItemSelected: {
        borderColor: '#FF3B30',
        backgroundColor: '#fff5f5',
        shadowColor: '#FF3B30',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 4,
    },
    reasonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    reasonTextContainer: {
        flex: 1,
        paddingRight: 12,
    },
    reasonTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    reasonTitleSelected: {
        color: '#FF3B30',
    },
    reasonDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    reasonDescriptionSelected: {
        color: '#FF6B60',
    },
    checkContainer: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF3B30',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    unselectedIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ddd',
        backgroundColor: 'transparent',
    },
    noReasonsContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    noReasonsText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
    actionContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingVertical: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    backButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
    },
    cancelButton: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF3B30',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    cancelButtonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0.1,
    },
    cancelButtonIcon: {
        marginRight: 8,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    
    // Confirmation Screen Styles
    confirmationContainer: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmationIconContainer: {
        marginBottom: 20,
        padding: 16,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    confirmationTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
        textAlign: 'center',
    },
    confirmationText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    confirmationButtons: {
        width: '100%',
        gap: 12,
    },
    goBackButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    goBackButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
    },
    confirmCancelButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF3B30',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    confirmCancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default CancelReasonsModal;