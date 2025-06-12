import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const BillDetails = ({ order }) => {
  const itemTotal = order.items.reduce((sum, item) => sum + item.price, 0);
  const deliveryFee = 40; // Example delivery fee
  const taxes = itemTotal * 0.05; // Example tax calculation (5%)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bill Details</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Item Total</Text>
        <Text style={styles.value}>₹{itemTotal.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Delivery Fee</Text>
        <Text style={styles.value}>₹{deliveryFee.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Taxes and Charges</Text>
        <Text style={styles.value}>₹{taxes.toFixed(2)}</Text>
      </View>

      {order.coupon_which_applied && (
        <View style={styles.row}>
          <Text style={styles.label}>Coupon Discount</Text>
          <Text style={[styles.value, styles.discount]}>
            -₹{order.coupon_which_applied.discount.toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>₹{order.totalPrice.toFixed(2)}</Text>
      </View>

      <View style={styles.paymentMethod}>
        <Text style={styles.paymentLabel}>Payment Method</Text>
        <Text style={styles.paymentValue}>{order.paymentMethod}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 15,
    margin: 10,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discount: {
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentMethod: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});