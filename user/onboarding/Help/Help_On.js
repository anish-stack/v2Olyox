import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Platform,
    Image,
    Alert,
} from 'react-native';
import { AntDesign, MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CommonActions, useNavigation } from '@react-navigation/native';

export default function Help_On() {
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [message, setMessage] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [loading, setLoading] = useState(false)
    const Navigation = useNavigation()

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,

            quality: 1,
        });

        if (!result.canceled) {
            setScreenshot(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!message || !number) {
            alert('Message and Number are required!');
            return;
        }

        if (!/^\d{10}$/.test(number)) {
            alert('Please enter a valid 10-digit number.');
            return;
        }



        const formData = new FormData();

        formData.append('name', name);
        formData.append('number', number);
        formData.append('message', message);

        if (screenshot) {
            const fileName = screenshot.split('/').pop();
            const fileType = fileName.split('.').pop();

            formData.append('image', {
                uri: screenshot,
                name: fileName,
                type: `image/${fileType}`,
            });
        }
        setLoading(true)
        try {
            const response = await fetch('http://192.168.1.6:3100/api/v1/admin/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert(
                    'Thank you!',
                    'Your issue has been sent to our support team. We’ll review it and get back to you as soon as possible. Sorry for the inconvenience caused.'
                );

                setName('');
                setNumber('');
                setMessage('');
                setScreenshot(null);
                Navigation.dispatch(
                    CommonActions.navigate({
                        name: 'Onboarding',
                        params: 'Onboarding'
                    })
                );
            } else {
                alert(`Error: ${data.message}`);
            }
            setLoading(false)

        } catch (error) {
            setLoading(false)

            console.error('Submit error:', error);
            alert('Something went wrong while submitting.');
        }
    };




    return (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
            {/* Help Guide Section */}
            <View style={styles.guideContainer}>
                <Text style={styles.title}>How to Register/Login</Text>

                <View style={styles.stepContainer}>
                    <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Enter WhatsApp Number</Text>
                        <Text style={styles.stepDescription}>
                            Enter your 10-digit WhatsApp number to begin the registration process
                        </Text>
                    </View>
                </View>

                <View style={styles.stepContainer}>
                    <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Verify OTP</Text>
                        <Text style={styles.stepDescription}>
                            Wait for the OTP on WhatsApp (up to 2 minutes). Enter the OTP to verify your number
                        </Text>
                    </View>
                </View>

                <View style={styles.stepContainer}>
                    <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Complete Profile</Text>
                        <Text style={styles.stepDescription}>
                            After verification, complete your profile information to finish the registration
                        </Text>
                    </View>
                </View>
            </View>

            {/* Issue Report Form */}
            <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Report an Issue</Text>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="person" size={24} color="#FF0000" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Your Name"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={24} color="#FF0000" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="WhatsApp Number Used"
                        value={number}
                        onChangeText={setNumber}
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.messageContainer}>
                    <TextInput
                        style={styles.messageInput}
                        placeholder="Describe your issue here..."
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                    <Ionicons name="camera" size={24} color="#fff" />
                    <Text style={styles.uploadButtonText}>Attach Screenshot</Text>
                </TouchableOpacity>

                {screenshot && (
                    <View style={styles.screenshotContainer}>
                        <Image source={{ uri: screenshot }} style={styles.screenshot} />
                        <TouchableOpacity
                            style={styles.removeScreenshot}
                            onPress={() => setScreenshot(null)}
                        >
                            <AntDesign name="closecircle" size={24} color="red" />
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>{loading ? 'Please Wait ....' : 'Submit Report'}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    guideContainer: {
        padding: 20,
        backgroundColor: '#fff',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    stepContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    stepNumber: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    stepNumberText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 5,
        color: '#333',
    },
    stepDescription: {
        fontSize: 14,
        color: '#FF0000',
        lineHeight: 20,
    },
    formContainer: {
        padding: 20,
        backgroundColor: '#fff',
    },
    formTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginBottom: 15,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
    },
    messageContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginBottom: 15,
        backgroundColor: '#fff',
    },
    messageInput: {
        padding: 15,
        fontSize: 16,
        textAlignVertical: 'top',
        minHeight: 100,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF0000',
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
    },
    uploadButtonText: {
        color: '#fff',
        fontSize: 16,
        marginLeft: 10,
    },
    screenshotContainer: {
        marginBottom: 15,
        position: 'relative',
    },
    screenshot: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    removeScreenshot: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});