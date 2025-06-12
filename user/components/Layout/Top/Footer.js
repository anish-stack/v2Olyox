import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import useSettings from '../../../hooks/Settings';

const Footer = ({ light = true }) => {
    const navigation = useNavigation();
    const { settings } = useSettings();

    const socialLinks = [
        { icon: 'facebook', url: settings?.fbUrl || 'https://facebook.com' },
        { icon: 'youtube', url: settings?.twitterUrl || 'https://twitter.com' },
        { icon: 'instagram', url: settings?.instagramUrl || 'https://instagram.com' },
    ];

    const handleSocialLink = async (url) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', 'Unable to open this link');
            }
        } catch (error) {
            console.error('Social link error:', error);
            Alert.alert('Error', 'Something went wrong while opening the link');
        }
    };

    return (
        <LinearGradient
            colors={light ? ['#ffffff', '#f2f2f2'] : ['#d53333', '#cb0000', '#db4d4d']}
            style={styles.footer}
        >
            <View style={styles.socialContainer}>
                {socialLinks.map((social, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.socialButton, light && styles.lightButton]}
                        onPress={() => handleSocialLink(social.url)}
                    >
                        <FontAwesome name={social.icon} size={22} color={light ? '#000' : '#fff'} />
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity onPress={() => navigation?.navigate?.('policy')}>
                <Text style={[styles.linkText, light && styles.lightText]}>
                    Read Terms and Conditions
                </Text>
            </TouchableOpacity>

            <Text style={[styles.copyText, light && styles.lightText]}>
                © {new Date().getFullYear()} Olyox. All rights reserved.
            </Text>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    footer: {
        paddingVertical: 20,
        paddingHorizontal: 15,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 12,
    },
    socialButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginHorizontal: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    linkText: {
        color: '#fff',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 5,
    },
    copyText: {
        color: '#fff',
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.8,
    },
    lightText: {
        color: '#000',
        opacity: 0.7,
    },
});

export default Footer;
