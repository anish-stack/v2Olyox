import React, { useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';

const OtpModal = React.memo(({ appState, updateState, handleOtpSubmit }) => {
    return useMemo(() => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={appState.showOtpModal}
            onRequestClose={() => updateState({ showOtpModal: false })}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.title}>Enter OTP</Text>
                    <Text style={styles.description}>
                        Please enter the OTP provided by the rider to start the trip
                    </Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Enter OTP"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={appState.otp}
                        onChangeText={(text) => updateState({ otp: text })}
                        autoFocus={appState.showOtpModal}
                    />
                    
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => updateState({ showOtpModal: false })}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[
                                styles.verifyButton, 
                                !appState.otp && styles.disabledButton
                            ]}
                            onPress={() => handleOtpSubmit()}
                            disabled={!appState.otp}
                        >
                            <Text style={styles.verifyText}>Verify</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    ), [appState.showOtpModal, appState.otp, handleOtpSubmit]);
});

// Styles
const styles = {
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContainer: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333'
    },
    description: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
        lineHeight: 20
    },
    input: {
        width: '100%',
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        marginBottom: 20,
        paddingHorizontal: 15,
        fontSize: 18,
        textAlign: 'center',
        backgroundColor: '#f9f9f9'
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between'
    },
    cancelButton: {
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        width: '45%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd'
    },
    cancelText: {
        color: '#333',
        fontWeight: '500'
    },
    verifyButton: {
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#FF3B30',
        width: '45%',
        alignItems: 'center'
    },
    disabledButton: {
        backgroundColor: '#ccc'
    },
    verifyText: {
        color: 'white',
        fontWeight: 'bold'
    }
};

export default OtpModal;