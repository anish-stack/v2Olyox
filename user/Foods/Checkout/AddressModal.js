import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const AddressModal = ({ visible, onClose, onSave, location_data }) => {
    const [address, setAddress] = useState({
        type: 'home', // home, work, other
        flatNo: '',
        street: '',
        landmark: '',

        pincode: '',
    });

    useEffect(() => {
        if (location_data) {
            setAddress((prev) => ({
                ...prev,
                type: location_data.type || '',
                flatNo: location_data.flatNo || '',
                street: location_data.completeAddress || '',
                landmark: location_data.landmark || '',

                pincode: location_data.postalCode || '',
            }))
        }
    }, [location_data])

    const handleSave = () => {
        if (!address.flatNo || !address.street || !address.pincode) {
            // Show error
            return;
        }
        onSave(address);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add Delivery Address</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.form}>
                        <View style={styles.addressTypes}>
                            {['home', 'work', 'other'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.addressType,
                                        address.type === type && styles.selectedAddressType,
                                    ]}
                                    onPress={() => setAddress({ ...address, type })}
                                >
                                    <Icon
                                        name={
                                            type === 'home'
                                                ? 'home'
                                                : type === 'work'
                                                    ? 'briefcase'
                                                    : 'map-marker'
                                        }
                                        size={20}
                                        color={address.type === type ? '#E23744' : '#666'}
                                    />
                                    <Text
                                        style={[
                                            styles.addressTypeText,
                                            address.type === type && styles.selectedAddressTypeText,
                                        ]}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Flat / House No."
                            value={address.flatNo}
                            onChangeText={(text) => setAddress({ ...address, flatNo: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Street / Area"
                            value={address.street}
                            onChangeText={(text) => setAddress({ ...address, street: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Landmark (Optional)"
                            value={address.landmark}
                            onChangeText={(text) => setAddress({ ...address, landmark: text })}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Pincode"
                            value={address.pincode}
                            keyboardType="numeric"
                            maxLength={6}
                            onChangeText={(text) => setAddress({ ...address, pincode: text })}
                        />

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Save Address</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        minHeight: Platform.OS=== "ios" ? '55%':'73%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    form: {
        padding: 16,
    },
    addressTypes: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    addressType: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        marginHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    selectedAddressType: {
        backgroundColor: '#FFE8E8',
        borderWidth: 1,
        borderColor: '#E23744',
    },
    addressTypeText: {
        marginLeft: 8,
        color: '#666',
    },
    selectedAddressTypeText: {
        color: '#E23744',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 12,
        height: 50,
        marginBottom: 16,
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: '#E23744',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddressModal;
