import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function WaitScreen() {
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [stauts, setStatus] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useNavigation();

    useEffect(() => {
        checkToken();
    }, []);

    const checkToken = async () => {
        setLoading(true);
        try {
            const token = await SecureStore.getItemAsync('auth_token_cab');
            if (token) {
                const response = await axios.get(
                    'http://192.168.1.6:3100/api/v1/rider/user-details',
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const partnerData = response.data.partner;
                setStatus(partnerData.DocumentVerify)
                if (partnerData?.documents) {
                    setUploadedDocuments(Object.entries(partnerData.documents));
                }
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Error fetching user details:', error.response?.data?.message);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };



    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFB300" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <MaterialCommunityIcons name="file" size={64} color="#FFB300" />
                    <Text style={styles.title}>Document Verification</Text>
                    <Text style={styles.subtitle}>
                        We're reviewing your documents to ensure everything is in order
                    </Text>
                </View>



                <View style={styles.documentsContainer}>
                    {uploadedDocuments.map(([key, value]) => (
                        <View key={key} style={styles.documentCard}>
                            <View style={styles.documentIcon}>
                                <MaterialCommunityIcons
                                    name={stauts ? "check-circle" : "clock"}
                                    size={24}
                                    color={stauts ? "#4CAF50" : "#FFB300"}
                                />
                            </View>
                            <View style={styles.documentInfo}>
                                <Text style={styles.documentTitle}>
                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                </Text>
                                <Text style={[
                                    styles.documentStatus,
                                    { color: stauts ? "#4CAF50" : "#FFB300" }
                                ]}>
                                    {stauts ? "Verified" : "Under Review"}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.messageContainer}>
                    <MaterialCommunityIcons name="information" size={24} color="#757575" />
                    <Text style={styles.message}>
                        Our team is carefully reviewing your documents. This process typically takes 24-48 hours.
                        We'll notify you once the verification is complete.
                    </Text>
                </View>

                {!isAuthenticated && (
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={() => router.navigate('/login')}
                    >
                        <Text style={styles.loginButtonText}>Return to Login</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={() => router.navigate('Onboarding')}
                >
                    <Text style={styles.loginButtonText}>Return to Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.supportButton}
                    onPress={() => router.navigate('support')}
                >
                    <MaterialCommunityIcons name="headset" size={20} color="#FFB300" />
                    <Text style={styles.supportButtonText}>Need Help?</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFF9C4',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF9C4',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#212121',
        marginTop: 16,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#757575',
        textAlign: 'center',
        marginHorizontal: 20,
    },
    progressContainer: {
        marginBottom: 32,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#FFF',
        borderRadius: 4,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFB300',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        color: '#757575',
        textAlign: 'center',
        marginTop: 8,
    },
    documentsContainer: {
        marginBottom: 32,
    },
    documentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    documentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF8E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    documentInfo: {
        flex: 1,
    },
    documentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        marginBottom: 4,
    },
    documentStatus: {
        fontSize: 14,
    },
    messageContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    message: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        color: '#757575',
        lineHeight: 20,
    },
    loginButton: {
        backgroundColor: '#FFB300',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    supportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF8E1',
        paddingVertical: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    supportButtonText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#FFB300',
    },
});