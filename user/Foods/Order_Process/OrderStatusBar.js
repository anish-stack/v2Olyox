import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const statusConfig = {
  Pending: {
    icon: 'clock-outline',
    color: '#FFA000',
    message: 'Waiting for restaurant confirmation',
  },
  Confirmed: {
    icon: 'check-circle-outline',
    color: '#4CAF50',
    message: 'Restaurant has confirmed your order',
  },
  Preparing: {
    icon: 'food-variant',
    color: '#2196F3',
    message: 'Chef is preparing your food',
  },
  'Out for Delivery': {
    icon: 'bike-fast',
    color: '#9C27B0',
    message: 'Your order is on the way',
  },
  Delivered: {
    icon: 'check-circle',
    color: '#4CAF50',
    message: 'Order delivered successfully',
  },
  Cancelled: {
    icon: 'close-circle',
    color: '#F44336',
    message: 'Order has been cancelled',
  },
};

export const OrderStatusBar = ({ currentStatus }) => {
  const config = statusConfig[currentStatus];

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name={config.icon} size={40} color={config.color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.status, { color: config.color }]}>{currentStatus}</Text>
        <Text style={styles.message}>{config.message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  iconContainer: {
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  status: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
});