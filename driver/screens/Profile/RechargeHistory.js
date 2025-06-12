import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,TouchableOpacity, SafeAreaView } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RechargeHistory() {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rechargeData, setRechargeData] = useState([]);
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            await fetchUserDetails();
        } catch (error) {
            setError('Failed to load user data');
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDetails = async () => {
        const token = await SecureStore.getItemAsync('auth_token_cab');
        if (!token) {
            throw new Error('No authentication token found');
        }

        // First fetch user details
        const userResponse = await axios.get(
            'https://appapi.olyox.com/api/v1/rider/user-details',
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const user = userResponse.data.partner;
        setUserData(user);

        // Then fetch recharge history using the user's BH
        if (user?.BH) {
            const rechargeResponse = await axios.get(
                `https://www.webapi.olyox.com/api/v1/get-recharge?_id=${user.BH}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRechargeData(rechargeResponse.data.data);
            console.log(rechargeResponse.data.data)
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        loadData().finally(() => setRefreshing(false));
    }, []);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF385C" />
                <Text style={styles.loadingText}>Loading your recharge history...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={48} color="#FF385C" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Recharge History</Text>
                <Text style={styles.headerSubtitle}>View your past transactions</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {rechargeData.map((recharge) => (
                    <View key={recharge._id} style={styles.transactionCard}>
                        <View style={styles.cardHeader}>
                            <View style={styles.planInfo}>
                                <Text style={styles.planName}>{recharge.member_id.title}</Text>
                                <Text style={styles.validity}>
                                    {recharge.member_id.validityDays} {recharge.member_id.whatIsThis}
                                </Text>
                            </View>
                            <View style={styles.amountContainer}>
                                <Text style={styles.amount}>
                                    {formatCurrency(recharge.amount)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.detailsContainer}>
                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons name="calendar" size={16} color="#666" />
                                <Text style={styles.detailText}>
                                    Valid till: {formatDate(recharge.end_date)}
                                </Text>
                            </View>

                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons name="receipt" size={16} color="#666" />
                                <Text style={styles.detailText}>
                                    Transaction ID: {recharge.trn_no}
                                </Text>
                            </View>

                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons
                                    name={recharge.payment_approved ? "check-circle" : "clock-outline"}
                                    size={16}
                                    color={recharge.payment_approved ? "#4CAF50" : "#FF9800"}
                                />
                                <Text style={[styles.detailText, { color: recharge.payment_approved ? "#4CAF50" : "#FF9800" }]}>
                                    {recharge.payment_approved ? "Payment Approved" : "Pending Approval"}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.dateContainer}>
                            <Text style={styles.dateText}>
                                Purchased on {formatDate(recharge.createdAt)}
                            </Text>
                        </View>
                    </View>
                ))}

                {rechargeData.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="history" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>No recharge history found</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#FF385C',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666',
    },
    scrollContent: {
        padding: 16,
    },
    transactionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    planInfo: {
        flex: 1,
    },
    planName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 4,
    },
    validity: {
        fontSize: 14,
        color: '#666',
    },
    amountContainer: {
        backgroundColor: '#f8f9fa',
        padding: 8,
        borderRadius: 8,
    },
    amount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF385C',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 16,
    },
    detailsContainer: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#666',
    },
    dateContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    dateText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'right',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
});