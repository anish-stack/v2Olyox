import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useFetchUserDetails } from '../../../hooks/New Hookes/RiderDetailsHooks';
import { colors } from '../../NewConstant';

// Skeleton Loader Component
const SkeletonLoader = () => {
    const SkeletonItem = ({ width, height, borderRadius = 4 }) => (
        <View
            style={[
                styles.skeleton,
                { width, height, borderRadius }
            ]}
        />
    );

    return (
        <View style={styles.container}>
            {/* Profile Section Skeleton */}
            <View style={styles.profileSection}>
                <SkeletonItem width={70} height={70} borderRadius={35} />
                <View style={styles.nameContainer}>
                    <SkeletonItem width={120} height={20} borderRadius={10} />
                    <View style={{ marginTop: 8 }}>
                        <SkeletonItem width={100} height={16} borderRadius={8} />
                    </View>
                </View>
            </View>

            {/* Recharge Section Skeleton */}
            <View style={styles.rechargeSection}>
                <SkeletonItem width={140} height={18} borderRadius={9} />
                <View style={{ marginTop: 12 }}>
                    <SkeletonItem width={180} height={16} borderRadius={8} />
                </View>
                <View style={{ marginTop: 8 }}>
                    <SkeletonItem width={160} height={16} borderRadius={8} />
                </View>
            </View>
        </View>
    );
};

// Status Badge Component
const StatusBadge = ({ isActive, daysLeft }) => {
    const getBadgeStyle = () => {
        if (!isActive) return { bg: colors.error, text: colors.white };
        if (daysLeft <= 3) return { bg: '#FF6B35', text: colors.white };
        if (daysLeft <= 7) return { bg: '#FFB800', text: colors.white };
        return { bg: colors.success, text: colors.white };
    };

    const getBadgeText = () => {
        if (!isActive) return 'INACTIVE';
        if (daysLeft <= 3) return 'EXPIRING SOON';
        if (daysLeft <= 7) return 'EXPIRES SOON';
        return 'ACTIVE';
    };

    const badgeStyle = getBadgeStyle();

    return (
        <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
            <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
                {getBadgeText()}
            </Text>
        </View>
    );
};

// Days Counter Component
const DaysCounter = ({ daysLeft, isActive }) => {
    if (!isActive) return null;

    const getCounterStyle = () => {
        if (daysLeft <= 3) return styles.dangerCounter;
        if (daysLeft <= 7) return styles.warningCounter;
        return styles.successCounter;
    };

    return (
        <View style={[styles.daysCounter, getCounterStyle()]}>
            <Text style={styles.daysNumber}>{daysLeft}</Text>
            <Text style={styles.daysLabel}>
                {daysLeft === 1 ? 'DAY LEFT' : 'DAYS LEFT'}
            </Text>
        </View>
    );
};

export default function RiderDataAndRechargeInfo({refreshing}) {
    const { userData, loading, error, fetchUserDetails } = useFetchUserDetails();

    useEffect(() => {
        fetchUserDetails();
    }, [refreshing]);

    // Calculate days remaining
    const calculateDaysLeft = (expireDate) => {
        if (!expireDate) return 0;
        const today = new Date();
        const endDate = new Date(expireDate);
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    if (loading) {
        return <SkeletonLoader />;
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>Unable to load data</Text>
                <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
            </View>
        );
    }

    const rechargeData = userData?.RechargeData;
    const rechargeAvailable = rechargeData?.approveRecharge;
    const rechargeEndDate = rechargeData?.expireData;
    const daysLeft = calculateDaysLeft(rechargeEndDate);
    const formattedEndDate = rechargeEndDate
        ? new Date(rechargeEndDate).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
        : null;

    return (
        <View style={styles.container}>
            {/* Profile Section */}
            <View style={styles.profileSection}>
                <View style={styles.profileImageContainer}>
                    {userData?.documents?.profile ? (
                        <Image
                            source={{ uri: userData.documents.profile }}
                            style={styles.profileImage}
                        />
                    ) : (
                        <View style={styles.profilePlaceholder}>
                            <Text style={styles.profilePlaceholderText}>
                                {userData?.name?.charAt(0)?.toUpperCase() || 'D'}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.profileInfo}>
                    <Text style={styles.nameText}>
                        {userData?.name || 'Driver'}
                    </Text>
                    <Text style={styles.phoneText}>
                        {userData?.phone || 'No phone number'}
                    </Text>
                </View>
            </View>

            {/* Recharge Section */}
            <View style={styles.rechargeSection}>
                <View style={styles.rechargeHeader}>
                    <Text style={styles.sectionTitle}>Subscription Status</Text>
                    <StatusBadge isActive={rechargeAvailable} daysLeft={daysLeft} />
                </View>

                {rechargeAvailable ? (
                    <View style={styles.rechargeContent}>
                        <View style={styles.rechargeRow}>
                            <View style={styles.rechargeInfo}>
                                <Text style={styles.rechargeLabel}>Current Plan</Text>
                                <Text style={styles.rechargePlan}>
                                    {rechargeData?.rechargePlan || 'Standard Plan'}
                                </Text>
                            </View>

                            <DaysCounter daysLeft={daysLeft} isActive={rechargeAvailable} />
                        </View>

                        <View style={styles.expiryInfo}>
                            <Text style={styles.expiryLabel}>Valid Until</Text>
                            <Text style={styles.expiryDate}>{formattedEndDate}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.inactiveContent}>
                        <Text style={styles.inactiveIcon}>🚫</Text>
                        <Text style={styles.inactiveTitle}>Subscription Expired</Text>
                        <Text style={styles.inactiveSubtext}>
                            Recharge now to continue using all features
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.backgroundDefault,
        gap: 16,
        marginBottom:5
    },

    // Skeleton Styles
    skeleton: {
        backgroundColor: '#E1E9EE',
        opacity: 0.7,
    },

    // Profile Section
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundPaper,
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 1,
    },

    profileImageContainer: {
        marginRight: 16,
    },

    profileImage: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 3,
        borderColor: colors.borderLight,
    },

    profilePlaceholder: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.borderLight,
    },

    profilePlaceholderText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.white,
    },

    profileInfo: {
        flex: 1,
    },

    nameText: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },

    phoneText: {
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '500',
    },

    // Recharge Section
    rechargeSection: {
        backgroundColor: colors.backgroundPaper,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 1,
    },

    rechargeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },

    // Badge Styles
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Recharge Content
    rechargeContent: {
        gap: 16,
    },

    rechargeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    rechargeInfo: {
        flex: 1,
    },

    rechargeLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 4,
        fontWeight: '500',
    },

    rechargePlan: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },

    // Days Counter
    daysCounter: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
    },

    successCounter: {
        backgroundColor: '#E8F5E8',
        borderColor: colors.success,
        borderWidth: 1,
    },

    warningCounter: {
        backgroundColor: '#FFF4E6',
        borderColor: '#FFB800',
        borderWidth: 1,
    },

    dangerCounter: {
        backgroundColor: '#FFEBEE',
        borderColor: '#FF6B35',
        borderWidth: 1,
    },

    daysNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
    },

    daysLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textSecondary,
        letterSpacing: 0.5,
    },

    // Expiry Info
    expiryInfo: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },

    expiryLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 4,
        fontWeight: '500',
    },

    expiryDate: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },

    // Inactive Content
    inactiveContent: {
        alignItems: 'center',
        paddingVertical: 20,
    },

    inactiveIcon: {
        fontSize: 40,
        marginBottom: 12,
    },

    inactiveTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.error,
        marginBottom: 8,
    },

    inactiveSubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },

    // Error States
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: colors.backgroundDefault,
    },

    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },

    errorText: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.error,
        marginBottom: 8,
        textAlign: 'center',
    },

    errorSubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },
});