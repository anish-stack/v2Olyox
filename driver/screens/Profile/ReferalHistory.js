import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    RefreshControl
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';

import { checkBhDetails } from '../../utils/Api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReferralHistory() {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [userData, setUserData] = useState(null);
    const [activeLevelTab, setActiveLevelTab] = useState('Level1');
    const [error, setError] = useState(null);

    const levels = ['Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7'];

    useEffect(() => {
        fetchUserDetails();
    }, []);

    const fetchUserDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await SecureStore.getItemAsync('auth_token_cab');
            if (!token) {
                setError('Authentication token not found. Please login again.');
                return;
            }

            const response = await axios.get(
                'http://192.168.1.6:3100/api/v1/rider/user-details',
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.partner) {
                const data = await checkBhDetails(response.data.partner?.BH);
                if (data.complete) {
                    setUserData(data.complete);
                } else {
                    setError('No referral data available');
                }
            } else {
                setError('Partner information not found');
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
            setError(error?.response?.data?.message || 'Failed to load referral data. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchUserDetails();
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Image
                source={{ uri: 'https://img.freepik.com/free-vector/referral-program-abstract-concept-vector-illustration-referral-marketing-method-friend-recommendation-acquire-new-customer-product-promotion-social-media-influencer-loyalty-abstract-metaphor_335657-2939.jpg?t=st=1740897094~exp=1740900694~hmac=54f3abe0ad21a0093a2eca77b46277114e96332f66f56ee552d4dbdbe1ddfcaf&w=900' }}
                style={styles.emptyImage}
            />
            <Text style={styles.emptyText}>No referrals found for {activeLevelTab}</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={fetchUserDetails}>
                <Icon name='download' size={16} color='#fff' />

                <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
        </View>
    );

    const renderErrorState = () => (
        <View style={styles.errorContainer}>
            <XCircle size={60} color="#f44336" />
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={fetchUserDetails}>
                <Icon name='download' size={16} color='#fff' />

                <Text style={styles.refreshButtonText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLevelTabs = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabScrollView}
            contentContainerStyle={styles.tabContainer}
        >
            {levels.map((level, index) => (
                <TouchableOpacity
                    key={index}
                    style={[
                        styles.tabButton,
                        activeLevelTab === level && styles.activeTabButton
                    ]}
                    onPress={() => setActiveLevelTab(level)}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeLevelTab === level && styles.activeTabText
                        ]}
                    >
                        {level}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderReferralCard = (item, index) => (
        <View key={index} style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.badgeContainer}>
                    <Icon name="gift" size={18} color="#fff" />


                </View>
                <Text style={styles.cardTitle}>Referral #{index + 1}</Text>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                    {/* <User size={18} color="#007bff" /> */}
                    <Icon name="user" size={18} color="#007bff" />

                    <Text style={styles.cardLabel}>Name:</Text>
                    <Text style={styles.cardText}>{item.name || 'N/A'}</Text>
                </View>

                <View style={styles.cardRow}>
                    {/* <Award size={18} color="#28a745" /> */}
                    <Icon name="share" size={18} color="#28a745" />
                    <Text style={styles.cardLabel}>BHID:</Text>
                    <Text style={styles.cardText}>{item?.myReferral || 'N/A'}</Text>
                </View>



                <View style={styles.cardRow}>
                    {/* <Phone size={18} color="#ff5722" /> */}
                    <Icon name="phone" size={18} color="#ff5722" />

                    <Text style={styles.cardLabel}>Phone:</Text>
                    <Text style={styles.cardText}>{item.number || 'N/A'}</Text>
                </View>

                <View style={styles.cardRow}>

                    <Icon name="credit-card" size={18} color="#3f51b5" />
                    <Text style={styles.cardLabel}>Plan:</Text>
                    <Text style={styles.cardText}>{item?.member_id?.title || 'Recharge Not Done'}</Text>
                </View>

                <View style={styles.cardRow}>
                    <Icon name="home" size={18} color="#3f51b5" />
                    <Text style={styles.cardLabel}>Category:</Text>
                    <Text style={styles.cardText}>{item?.category?.title || 'N/A'}</Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <View style={[
                    styles.statusBadge,
                    item?.plan_status ? styles.activeBadge : styles.inactiveBadge
                ]}>
                    {item?.plan_status ?
                        'check' :
                        'cross'
                    }
                    <Text style={styles.statusText}>
                        {item?.plan_status ? 'Active' : 'Inactive'}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Icon name="history" size={24} color="#007bff" />
                    {/* <History  /> */}
                    <Text style={styles.heading}>Referral History</Text>
                </View>

                {renderLevelTabs()}

                {loading && !refreshing ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#007bff" />
                        <Text style={styles.loaderText}>Loading referrals...</Text>
                    </View>
                ) : error ? (
                    renderErrorState()
                ) : (
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollViewContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={['#007bff']}
                                tintColor="#007bff"
                            />
                        }
                    >
                        {userData && userData[activeLevelTab] && userData[activeLevelTab].length > 0 ? (
                            userData[activeLevelTab].map((item, index) => renderReferralCard(item, index))
                        ) : (
                            renderEmptyState()
                        )}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    heading: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 8,
    },
    tabScrollView: {
        maxHeight: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    tabContainer: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        marginRight: 10,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    activeTabButton: {
        backgroundColor: '#007bff',
    },
    tabText: {
        fontSize: 14,
        color: '#555',
        fontWeight: '600',
    },
    activeTabText: {
        color: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        padding: 15,
        paddingBottom: 30,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f9f9f9',
    },
    badgeContainer: {
        backgroundColor: '#007bff',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#eee',
    },
    cardContent: {
        padding: 15,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginLeft: 8,
        width: 70,
    },
    cardText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    cardFooter: {
        padding: 15,
        backgroundColor: '#f9f9f9',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    activeBadge: {
        backgroundColor: '#28a745',
    },
    inactiveBadge: {
        backgroundColor: '#dc3545',
    },
    statusText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    emptyImage: {
        width: 300,
        height: 300,
        resizeMode: 'cover',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007bff',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
    },
    refreshButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 15,
        marginBottom: 10,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
});