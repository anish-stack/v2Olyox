import React from 'react';
import { View, TextInput } from 'react-native';
import Icon from "react-native-vector-icons/FontAwesome5";
import { styles } from './parcel-booking.styles';
export const OtherInput = ({ 
  icon, 
  placeholder, 
  value, 
  onChangeText, 
 
}) => {
  return (
    <>
    <View style={styles.inputContainer}>
      <Icon name={icon} size={20} color="#9ca3af" />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
      />
      
    </View>
    </>
  );
};