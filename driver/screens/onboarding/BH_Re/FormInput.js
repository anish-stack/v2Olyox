import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function FormInput({
  label,
  value,
  onChangeText,
  editable = true,
  autoComplete = "off", // Default to "off" for React Native
  textContentType = "none", // Default to "none" to prevent autofill guessing
  error,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  maxLength,
  // Add new props for better autofill control
  importantForAutofill = "auto",
  autoCorrect = false,
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
       
        importantForAutofill={importantForAutofill} // Control autofill importance
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        autoComplete={autoComplete}
        textContentType={textContentType}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength} // Add maxLength support
        autoCorrect={autoCorrect} // Disable autocorrect for sensitive fields
        autoCapitalize="none" // Prevent auto capitalization by default
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ff0000',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 12,
    marginTop: 5,
  },
});
