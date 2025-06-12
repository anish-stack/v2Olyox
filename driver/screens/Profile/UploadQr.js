import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_URL = 'https://appapi.olyox.com/api/v1/rider/rider-uploadPaymentQr';
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

export default function UploadQr() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigation = useNavigation();

  const checkImageSize = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      console.error('Error checking image size:', error);
      return 0;
    }
  };

  const pickImage = async () => {
    try {
      setLoading(true);
      setError(null);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        setError('Permission to access media library was denied');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const imageSize = await checkImageSize(result.assets[0].uri);

        if (imageSize > MAX_IMAGE_SIZE) {
          setError('Image size must be less than 2MB');
          return;
        }

        setImage(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      setError('Please select an image first');
      return;
    }
    console.log(image)
    try {
      setLoading(true);
      setError(null);

      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const formData = new FormData();

      // Get the file extension from the URI
      const uriParts = image.split('.');
      const fileType = uriParts[uriParts.length - 1];

      formData.append('image', {
        uri: image,
        name: `qr.${fileType}`,
        type: `image/${fileType}`,
      });

      const response = await axios.post(API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        Alert.alert(
          'Success',
          'QR code uploaded successfully! Please login now.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (err) {
      console.log(err.response.data)
      const errorMessage = err.response?.data?.message || err.message || 'Failed to upload QR code';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Upload Payment QR Code</Text>
          <Text style={styles.subtitle}>Please upload a clear image of your payment QR code</Text>

          <TouchableOpacity
            style={styles.uploadArea}
            onPress={pickImage}
            disabled={loading}
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholder}>
                <MaterialCommunityIcons name="qrcode" size={48} color="#6366F1" />
                <Text style={styles.placeholderText}>Tap to select QR code</Text>
                <Text style={styles.sizeLimit}>Maximum size: 2MB</Text>
              </View>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {loading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.progressText}>
                {uploadProgress > 0 ? `Uploading: ${uploadProgress}%` : 'Processing...'}
              </Text>
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!image || loading}
            style={[styles.submitButton, (!image || loading) && styles.submitButtonDisabled]}
            loading={loading}
          >
            Upload QR Code
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  uploadArea: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 20,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  sizeLimit: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    color: '#EF4444',
    fontSize: 14,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 8,
    backgroundColor: '#6366F1',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
});