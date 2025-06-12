import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Clipboard, ToastAndroid, ScrollView } from 'react-native';
import React, { useState } from 'react';
import { MaterialCommunityIcons, Feather, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useGetCoupons from '../../hooks/GetUnlockCopons';

export default function UnlockCoupons() {
  // const  =u
  const { coupons, loading, refresh } = useGetCoupons();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleCopyCode = (code) => {
    Clipboard.setString(code);
    ToastAndroid.show('Coupon code copied!', ToastAndroid.SHORT);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderCouponItem = ({ item }) => {
    const expirationDate = formatDate(item.expirationDate);

    return (
      <LinearGradient
        colors={['#f5f7fa', '#c3cfe2']}
        style={styles.couponContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.couponHeader}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => handleCopyCode(item.code)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="content-copy" size={16} color="#fff" />
            <Text style={styles.copyText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.couponBody}>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Code:</Text>
            <Text style={styles.codeValue}>{item.code}</Text>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <FontAwesome name="percent" size={14} color="#555" style={styles.icon} />
              <Text style={styles.detailLabel}>Discount:</Text>
              <Text style={styles.detailValue}>{item.discount}%</Text>
            </View>

            <View style={styles.detailItem}>
              <Feather name="calendar" size={14} color="#555" style={styles.icon} />
              <Text style={styles.detailLabel}>Expires:</Text>
              <Text style={styles.detailValue}>{expirationDate}</Text>
            </View>
          </View>
          {item?.isUsed && (
            <View
              style={{
                backgroundColor: '#f44336', // red
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 12,
                alignSelf: 'flex-start',
                marginTop: 6,
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                This coupon has already been used.
              </Text>
            </View>
          )}

        </View>
      </LinearGradient>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7367F0" />
        <Text style={styles.loadingText}>Loading coupons...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
     
<ScrollView
  contentContainerStyle={styles.listContainer}
  showsVerticalScrollIndicator={false}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={['#7367F0']}
    />
  }
>
  {coupons && coupons.length > 0 ? (
    coupons.map((item, index) => (
      <View key={item._id || index}>
        {renderCouponItem({ item, index })}
      </View>
    ))
  ) : (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="ticket-percent-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No coupons available</Text>
    </View>
  )}
</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#7367F0',
    fontSize: 16,
  },
  couponContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7367F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  copyText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  couponBody: {
    padding: 16,
  },
  codeContainer: {
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: '#333',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#555',
    marginRight: 4,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idLabel: {
    fontSize: 11,
    color: '#888',
  },
  idValue: {
    fontSize: 11,
    color: '#888',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
});