import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Linking,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSettings from '../../hooks/settings.hook';

export default function SupportScreen() {
    const { settings, loading, error } = useSettings();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');



    // console.log(settings)
    const handleSubmit = () => {
        // Handle form submission here
        console.log({ name, email, message });
        // Reset form
        setName('');
        setEmail('');
        setMessage('');
    };
    console.log(settings)

    const whatsappNumber = '+91 7015716178';
    const openWhatsApp = () => {
        const url = `https://wa.me/${whatsappNumber}`;
        Linking.openURL(url);
    };

    const makeCall = () => {
        const url = Platform.OS === 'ios' ? `telprompt:${settings?.support_number || '01141236789'}` : `tel:${settings?.support_number || '01141236789'}`;
        Linking.openURL(url);
    };

    const sendEmail = () => {
        Linking.openURL(`mailto:${settings?.adminEmail || 'helpcenter@olyox.com'}`);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>How can we help?</Text>
                    <Text style={styles.subtitle}>We're here to assist you</Text>
                </View>

                <View style={styles.contactCards}>
                    <TouchableOpacity style={styles.card} onPress={makeCall}>
                        <Ionicons name="call" size={24} color="#F59E0B" />
                        <Text style={styles.cardTitle}>Call Us</Text>
                        <Text style={styles.cardText}>
                            {settings?.support_number
                                ? (settings.support_number.toString().startsWith('0')
                                    ? settings.support_number
                                    : '0' + settings.support_number)
                                : phoneNumber}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={sendEmail}>
                        <Ionicons name="mail" size={24} color="#F59E0B" />
                        <Text style={styles.cardTitle}>Email Us</Text>
                        <Text style={styles.cardText}>{settings?.adminEmail || emailAddress}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={openWhatsApp}>
                        <Ionicons name="logo-whatsapp" size={24} color="#F59E0B" />
                        <Text style={styles.cardTitle}>WhatsApp</Text>
                        <Text style={styles.cardText}>Chat with us</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>Send us a message</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Your Name"
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#666"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Your Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        placeholderTextColor="#666"
                    />

                    <TextInput
                        style={styles.messageInput}
                        placeholder="Your Message"
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor="#666"
                    />

                    <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                        <Text style={styles.submitButtonText}>Submit</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFBEB',
    },
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 30,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#F59E0B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
    contactCards: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    card: {
        width: '31%',
        backgroundColor: '#FEF3C7',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#F59E0B',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400E',
        marginTop: 8,
        marginBottom: 4,
    },
    cardText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: '#FEF3C7',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#F59E0B',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#92400E',
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#FFFBEB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    messageInput: {
        backgroundColor: '#FFFBEB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    submitButton: {
        backgroundColor: '#F59E0B',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});