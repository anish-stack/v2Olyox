import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import FormInput from './FormInput';
import axios from 'axios';



export default function AddressForm({ address, onAddressChange, errors }) {
  const [addressSuggestions, setAddressSuggestions] = useState([]);

  const fetchAddressSuggestions = async (query) => {
    if (!query.trim()) return;
    try {
      const res = await axios.get(
        `https://api.blueaceindia.com/api/v1/autocomplete?input=${encodeURIComponent(query)}`
      );
      console.log(res.data)
      setAddressSuggestions(res.data);
    } catch (err) {
      console.error('Error fetching address suggestions:', err);
    }
  };

  const fetchGeocode = async (selectedAddress) => {
    try {
      const res = await axios.get(
        `https://api.blueaceindia.com/api/v1/geocode?address=${encodeURIComponent(
          selectedAddress?.description
        )}`
      );
      const { latitude, longitude } = res.data;
      onAddressChange('location', {
        type: 'Point',
        coordinates: [longitude, latitude],
      });
    } catch (err) {
      console.error('Error fetching geocode:', err);
    }
  };

  return (
    <View style={styles.container}>
      <FormInput
        label="Area"
        value={address.area}
        onChangeText={(text) => onAddressChange('area', text)}
        placeholder="Enter your area"
      />
      <FormInput
        label="Street Address"
        value={address.street_address}
        onChangeText={(text) => {
          onAddressChange('street_address', text);
          fetchAddressSuggestions(text);
        }}
        placeholder="Enter street address"
      />
      <FormInput
        label="Landmark"
        value={address.landmark}
        onChangeText={(text) => onAddressChange('landmark', text)}
        placeholder="Enter landmark"
      />
      <FormInput
        label="Pincode"
        value={address.pincode}
        onChangeText={(text) => onAddressChange('pincode', text)}
        placeholder="Enter pincode"
        keyboardType="numeric"
        error={errors.pincode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
});