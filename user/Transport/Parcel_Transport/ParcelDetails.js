import React from 'react';
import { View, TextInput, Text } from 'react-native';
import Icon from "react-native-vector-icons/FontAwesome5";
import { styles } from './parcel-booking.styles';

export const ParcelDetails = ({ 
  weight, 
  setWeight, 
  length, 
  setLength, 
  width, 
  setWidth, 
  height, 
  setHeight 
}) => {
  return (
    <>
      <Text style={styles.sectionTitle}>Parcel Details</Text>
      
      <View style={styles.inputContainer}>
        <Icon name="weight-hanging" size={20} color="#9ca3af" />
        <TextInput
          style={styles.input}
          placeholder="Weight (kg)"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.dimensionsContainer}>
        <Icon name="cube" size={20} color="#9ca3af" style={styles.dimensionIcon} />
        <TextInput
          style={styles.dimensionInput}
          placeholder="L (cm)"
          value={length}
          onChangeText={setLength}
          keyboardType="numeric"
        />
        <Text style={styles.dimensionX}>x</Text>
        <TextInput
          style={styles.dimensionInput}
          placeholder="W (cm)"
          value={width}
          onChangeText={setWidth}
          keyboardType="numeric"
        />
        <Text style={styles.dimensionX}>x</Text>
        <TextInput
          style={styles.dimensionInput}
          placeholder="H (cm)"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
      </View>
    </>
  );
};