import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function Report({ isRefresh }) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigation = useNavigation()
    useEffect(() => {
        const fetchReportData = async () => {
            try {
                const token = await SecureStore.getItemAsync('auth_token_cab');
                if (!token) {
                    setError("Authentication token not found");
                    setLoading(false);
                    return;
                }

                const response = await axios.get('http://192.168.1.6:3100/api/v1/rider/getMyAllDetails', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                console.log("🚀 Report Data:", response.data);
                setReportData(response.data);
            } catch (err) {
                console.error("Error fetching report data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [isRefresh]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    const StatCard = ({ icon, iconColor, bgColor, value, label, route }) => (
        <TouchableOpacity onPress={() => navigation.navigate(route)} style={[styles.statsCard, { flex: 1 }]}>
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
                <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
            </View>
            <Text style={styles.statsValue}>{value}</Text>
            <Text style={styles.statsLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Performance Report</Text>
                <Text style={styles.subtitle}>Your riding statistics</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statsRow}>
                    <StatCard
                        icon="bike"
                        iconColor="#6366F1"
                        bgColor="#EEF2FF"
                        route={'AllRides'}
                        value={reportData?.totalRides || 0}
                        label="Total Rides"
                    />
                    <StatCard
                        icon="calendar-clock"
                        iconColor="#7C3AED"
                        route={'WorkingData'}

                        bgColor="#F3E8FF"
                        value={"Check"}
                        label="Working Days"
                    />

                </View>

                <View style={styles.statsRow}>
                    <StatCard
                        icon="star"
                        iconColor="#F59E0B"
                        route={""}

                        bgColor="#FEF3C7"
                        value={reportData?.averageRating?.toFixed(1) || '0.0'}
                        label="Average Rating"
                    />
                    <StatCard
                        icon="cash"
                        iconColor="#22C55E"
                        route={""}
                        bgColor="#F0FDF4"
                        value={`₹${reportData?.totalEarnings?.toFixed(2) || '0.00'}`}
                        label="Total Earnings"
                    />
                </View>
            </View>

            <View style={styles.infoCard}>
                <MaterialCommunityIcons name="information" size={20} color="#6366F1" />
                <Text style={styles.infoText}>
                    Keep up the great work! Your performance directly impacts your earnings and ratings.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 20,
    },
    errorText: {
        marginTop: 12,
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    statsContainer: {
        gap: 16,
        marginBottom: 24,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    statsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statsValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    statsLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoCard: {
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#4F46E5',
        lineHeight: 20,
    },
});