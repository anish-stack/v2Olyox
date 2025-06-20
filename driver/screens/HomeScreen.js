import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import ParcelHome from './ParcelHome';
import CabHome from './CabHome';
import { initializeSocket } from '../context/socketService';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useSocket } from '../context/SocketContext';
import { useNavigation } from '@react-navigation/native';
import NewHomeScreen from '../New Screens/NewDriverScreen';

const API_BASE_URL = "http://192.168.1.6:3100/api/v1";

export default function HomeScreen() {
  const navigation = useNavigation();
  const [role, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [retrying, setRetrying] = useState(false); // Make sure this is boolean
  const { isSocketReady, socket } = useSocket();

  const fetchUserDetails = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      if (retrying) setRetrying(true);
      
      // Get authentication token
      const token = await SecureStore.getItemAsync("auth_token_cab");
      
      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }
      
      // Make API request to get user details
      const response = await axios.get(`${API_BASE_URL}/rider/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000, // 10 second timeout
      });
      
      const partner = response?.data?.partner;
      
      if (!partner) {
        throw new Error("No user data received from server");
      }
      
      if (!partner.category) {
        throw new Error("User role not defined. Please contact support.");
      }
      
      // Set user role and initialize socket
      setUserRole(partner.category);
      setErrorMsg(null);
      
      // Initialize socket connection with explicit type conversion for any potential boolean flags
      // await initializeSocket({
      //   userId: partner._id,
      //   // Convert any potential string booleans to actual booleans if needed
      //   // For example, if there were any boolean flags:
      //   // isActive: String(someValue) === 'true' || someValue === true
      // });
      
    } catch (error) {
      // Handle different types of errors
      if (axios.isCancel(error)) {
        setErrorMsg("Request was cancelled. Please try again.");
      } else if (error.code === 'ECONNABORTED') {
        setErrorMsg("Connection timed out. Please check your internet and try again.");
      } else if (error.response) {
        // Server responded with error status
        const statusCode = error.response.status;
        if (statusCode === 401) {
          setErrorMsg("Session expired. Please login again.");
          // Could navigate to login screen here
          // navigation.navigate('Login');
        } else if (statusCode === 403) {
          setErrorMsg("You don't have permission to access this resource.");
        } else {
          setErrorMsg(error.response.data?.message || `Server error (${statusCode})`);
        }
      } else if (error.request) {
        // Request made but no response received
        setErrorMsg("Network error. Please check your internet connection.");
      } else {
        // Something else happened
        setErrorMsg(error.message || "An unexpected error occurred");
      }
      
      console.error("Error fetching user details:", error);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, []);

  useEffect(() => {
    if (!socket || role !== 'parcel') return;
    
    const handleNewParcel = (response) => {
      // console.log("📦 New Parcel Received:", response);
      
      if (!response || !response.parcel) {
        console.error("Invalid parcel data received:", response);
        Alert.alert(
          "New Delivery",
          "A new delivery is available but details could not be loaded. Please refresh the app.",
          [{ text: "OK" }]
        );
        return;
      }
      
      // Ensure parcelId is properly handled as string if needed
      const parcelId = response.parcel;
      navigation.reset({
        index: 0,
        routes: [{ name: 'ParcelDetails', params: { parcelId } }],
      });
    };
    
    // Register socket event listener
    socket.on('new_parcel_come', handleNewParcel);
    
    // Clean up function
    return () => {
      socket.off('new_parcel_come', handleNewParcel);
    };
  }, [socket, role, navigation]);

  const handleRetry = () => {
    setErrorMsg(null);
    fetchUserDetails(false);
  };

  // Memoized component based on role
  const RenderedComponent = useMemo(() => {
    if (role === 'parcel') return <ParcelHome />;
    // if (role === 'cab') return <CabHome />;
    if (role === 'cab') return <NewHomeScreen />;
    return null;
  }, [role]);

  // Convert any boolean checks to be explicit
  const isLoading = loading === true;
  const hasError = errorMsg !== null;
  const isRetrying = retrying === true;
  const hasRole = role !== null;

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d6efd" />
        <Text style={styles.text}>Loading user details...</Text>
      </View>
    );
  }

  // Error state
  if (hasError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Unable to load</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.retryButtonText}>Retry</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // No role defined (should rarely happen after successful API call)
  if (!hasRole) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User role not defined. Please contact support.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render the appropriate component based on role
  return <>{RenderedComponent}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5'
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8
  },
  errorText: {
    color: '#555',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: '#0d6efd',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center'
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  }
});