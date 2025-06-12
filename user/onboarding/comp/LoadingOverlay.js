// LoadingOverlay.js
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';


const LoadingOverlay = ({ visible }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.container}>
      <View
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 250 }}
        style={styles.loaderContainer}
      >
        <ActivityIndicator size="large" color="#ec363f" />
        <Text style={styles.loadingText}>Please wait...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loaderContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minWidth: 150,
  },
  loadingText: {
    marginTop: 10,
    color: '#333',
    fontSize: 14,
  },
});

export default LoadingOverlay;