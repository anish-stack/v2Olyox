import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import useSettings from '../../../hooks/settings.hook';

const BhVerification = () => {
  const [bh, setBh] = useState('BH');
  const [name, setName] = useState('');
  const [response, setResponse] = useState(null);
  const { settings } = useSettings();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const navigation = useNavigation();

  const checkBhId = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.post('https://www.api.olyox.com/api/v1/check-bh-id', { bh });

      if (!data.success) {
        setLoading(false);
        return setError(data.message || 'Failed to validate BH ID.');
      }

      setName(data.data);
      setResponse(data);

      setTimeout(() => {
        navigation.navigate('Register', { bh_id: bh });
      }, 1200);
    } catch (err) {
      setResponse(null);
      console.log(err);
      setError(err.response?.data?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    console.log('Skip button pressed');
    setSkipping(true);

    // Check if adminBh exists in settings
    if (settings && settings.adminBh) {
      console.log(`Using admin BH ID from settings: ${settings.adminBh}`);
      setTimeout(() => {
        navigation.navigate('Register', { bh_id: settings.adminBh });
        setSkipping(false);
      }, 1000);
    } else {
      console.log('No admin BH ID found in settings');
      setError('No default BH ID available. Please enter a valid BH ID or contact support.');
      setSkipping(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={{ uri: 'https://res.cloudinary.com/dlasn7jtv/image/upload/v1735719280/llocvfzlg1mojxctm7v0.png' }}
          style={styles.logo}
        />

        <Text style={styles.title}>Enter Your BH ID</Text>
        <Text style={styles.subtitle}>Register at olyox.com and start earning today</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your BH ID"
          value={bh}
          onChangeText={setBh}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={checkBhId}
          disabled={loading || skipping}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify BH ID</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={loading || skipping}
        >
          {skipping ? (
            <ActivityIndicator color="#666" />
          ) : (
            <Text style={styles.skipButtonText}>Don't have a BH ID? Skip</Text>
          )}
        </TouchableOpacity>

        {response && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{response.message || 'BH ID verified successfully!'} Redirecting...</Text>
          </View>
        )}

        {skipping && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Using default BH ID. Redirecting...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#e3342f',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  skipButton: {
    width: '100%',
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    textDecorationLine: 'underline',
  },
  successBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#d4edda',
    borderRadius: 8,
    width: '100%',
  },
  successText: {
    color: '#155724',
    textAlign: 'center',
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#721c24',
    textAlign: 'center',
  },
});

export default BhVerification;