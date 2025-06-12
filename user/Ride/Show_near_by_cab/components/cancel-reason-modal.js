import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    Dimensions,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');


export const CancelReasonModal = React.memo(({ 
    visible, 
    setVisible, 
    cancelReason, 
    selectedReason, 
    setSelectedReason,
    handleCancelRide
}) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={() => setVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Cancel Reason</Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setVisible(false)}
                        >
                            <MaterialCommunityIcons name="close" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>
                    
                    {cancelReason && cancelReason.length > 0 ? (
                        cancelReason.map((item) => (
                            <TouchableOpacity
                                key={item._id}
                                style={[
                                    styles.cancelReasonItem,
                                    selectedReason === item._id && styles.selectedReason
                                ]}
                                onPress={() => setSelectedReason(item._id)}
                            >
                                <View>
                                    <Text style={styles.cancelReasonLabel}>{item.name}</Text>
                                    <Text style={styles.cancelReasonDescription}>{item.description}</Text>
                                </View>
                                <View>
                                    {selectedReason === item._id && (
                                        <MaterialCommunityIcons name="check" size={24} color="green" />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.noReasonsText}>No cancellation reasons available</Text>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.cancelRideButton,
                            !selectedReason && styles.cancelRideButtonDisabled
                        ]}
                        onPress={handleCancelRide}
                        disabled={!selectedReason}
                    >
                        <MaterialCommunityIcons name="cancel" size={20} color="#fff" />
                        <Text style={styles.cancelRideText}>Cancel Ride</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: height * 0.8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelReasonItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "start",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
    },
    selectedReason: {
        backgroundColor: "#e3f2fd",
        borderRadius: 5,
    },
    cancelReasonLabel: {
        fontSize: 16,
        color: "#111827",
    },
    cancelReasonDescription: {
        fontSize: 14,
        color: "#6b7280",
    },
    cancelRideButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#d64444",
        paddingVertical: 12,
        borderRadius: 5,
        marginTop: 20,
    },
    cancelRideButtonDisabled: {
        backgroundColor: "#cccccc",
    },
    cancelRideText: {
        fontSize: 16,
        color: "#fff",
        marginLeft: 10,
    },
    noReasonsText: {
        fontSize: 16,
        color: "#6b7280",
        textAlign: "center",
        marginVertical: 20,
    },
});