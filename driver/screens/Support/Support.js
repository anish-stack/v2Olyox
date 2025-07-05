import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Linking,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSettings from '../../hooks/settings.hook';
import { useFetchUserDetails } from '../../hooks/New Hookes/RiderDetailsHooks';

export default function SupportScreen() {
    const { settings, loading, error } = useSettings();
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [message, setMessage] = useState('');
    const [bhId, setBhId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { fetchUserDetails, userData } = useFetchUserDetails();

    const handleSubmit = async () => {
        if (!name.trim() || !mobile.trim() || !message.trim() || !bhId.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setIsSubmitting(true);

        try {
            const formattedMessage = `Name: ${name}\nMobile: ${mobile}\nBH ID: ${bhId}\nMessage: ${message}`;
            const apiUrl = `http://api.wtap.sms4power.com/wapp/v2/api/send?apikey=968791cad69d4ec0a97639f33c19ce68&mobile=8059025804&msg=${encodeURIComponent(formattedMessage)}`;

            const response = await fetch(apiUrl);
            const result = await response.json();

            if (response.ok) {
                Alert.alert('Success', 'Your message has been sent successfully!');

            } else {
                Alert.alert('Error', 'Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Network error. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const whatsappNumber = '+91 7015716178';
    const openWhatsApp = () => {
        const url = `https://wa.me/${whatsappNumber}`;
        Linking.openURL(url);
    };

    useEffect(() => {
        fetchUserDetails()
        if (userData) {
            setBhId(userData?.BH || 'BH')
            setName(userData?.name || '')
            setMobile(userData?.phone || '')
        }
    }, [])

    const makeCall = () => {
        const url = Platform.OS === 'ios' ? `telprompt:${settings?.support_number || '01141236789'}` : `tel:${settings?.support_number || '01141236789'}`;
        Linking.openURL(url);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>Need Help?</Text>
                    <Text style={styles.subtitle}>We're here to support you 24/7</Text>
                </View>

                <View style={styles.contactCards}>
                    <TouchableOpacity style={styles.card} onPress={makeCall}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="call" size={28} color="#FFFFFF" />
                        </View>
                        <Text style={styles.cardTitle}>Call Us</Text>
                        <Text style={styles.cardText}>
                            {settings?.support_number
                                ? (settings.support_number.toString().startsWith('0')
                                    ? settings.support_number
                                    : '0' + settings.support_number)
                                : "Available 24/7"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.card} onPress={openWhatsApp}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="logo-whatsapp" size={28} color="#FFFFFF" />
                        </View>
                        <Text style={styles.cardTitle}>WhatsApp</Text>
                        <Text style={styles.cardText}>Chat with us</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>Send us a message</Text>
                    <Text style={styles.formSubtitle}>Fill out the form below and we'll get back to you</Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#DC2626" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Your Name"
                            value={name}
                            readOnly={true}
                            onChangeText={setName}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Ionicons name="id-card-outline" size={20} color="#DC2626" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="BH ID"
                            value={bhId}
                            readOnly={true}
                            onChangeText={setBhId}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Ionicons name="call-outline" size={20} color="#DC2626" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Mobile Number"
                            value={mobile}
                            onChangeText={setMobile}
                            keyboardType="phone-pad"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>



                    <View style={styles.messageContainer}>
                        <Ionicons name="chatbubble-outline" size={20} color="#DC2626" style={styles.messageIcon} />
                        <TextInput
                            style={styles.messageInput}
                            placeholder="Your Message"
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            numberOfLines={4}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.submitButtonText}>
                            {isSubmitting ? 'Sending...' : 'Send Message'}
                        </Text>
                        {!isSubmitting && <Ionicons name="send" size={20} color="#FFFFFF" style={styles.submitIcon} />}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#DC2626',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
    },
    contactCards: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 30,
    },
    card: {
        width: '45%',
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#DC2626',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#DC2626',
        marginBottom: 6,
    },
    cardText: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        padding: 25,
        borderRadius: 20,
        shadowColor: '#DC2626',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    formTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#DC2626',
        marginBottom: 8,
        textAlign: 'center',
    },
    formSubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 25,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 15,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1E293B',
    },
    messageContainer: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 15,
        paddingTop: 15,
        alignItems: 'flex-start',
    },
    messageIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    messageInput: {
        flex: 1,
        minHeight: 100,
        textAlignVertical: 'top',
        fontSize: 16,
        color: '#1E293B',
        paddingBottom: 15,
    },
    submitButton: {
        backgroundColor: '#DC2626',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        shadowColor: '#DC2626',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    submitButtonDisabled: {
        backgroundColor: '#94A3B8',
        shadowOpacity: 0.1,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    submitIcon: {
        marginLeft: 8,
    },
});