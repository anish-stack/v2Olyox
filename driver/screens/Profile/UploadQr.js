import React, { useState, useEffect } from 'react';
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
import { Text, Button, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFetchUserDetails } from '../../hooks/New Hookes/RiderDetailsHooks';

const API_URL = 'http://192.168.1.6:3100/api/v1/rider/rider-uploadPaymentQr';
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

export default function UploadQr() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploader, setShowUploader] = useState(false);
  const navigation = useNavigation();
  const { userData, fetchUserDetails } = useFetchUserDetails();

  // Check if user has existing QR code on component mount
  useEffect(() => {
    if (userData && !userData.YourQrCodeToMakeOnline) {
      setShowUploader(true);
    }
  }, [userData]);

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

    try {
      setLoading(true);
      setError(null);

      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const formData = new FormData();

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
          'QR code uploaded successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                fetchUserDetails(); // Refresh user data
                setShowUploader(false); // Hide uploader
                setImage(null); // Clear selected image
              },
            },
          ]
        );
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (err) {
      console.log(err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to upload QR code';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleChangeQr = () => {
    setShowUploader(true);
    setImage(null);
    setError(null);
  };

  const handleCancelChange = () => {
    setShowUploader(false);
    setImage(null);
    setError(null);
  };

  useEffect(()=>{
    fetchUserDetails()
  },[])

  // Show existing QR code if available and uploader is not shown
  if (userData?.YourQrCodeToMakeOnline && !showUploader) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Your Payment QR Code</Text>
            <Text style={styles.subtitle}>This is your current payment QR code</Text>

            <Card style={styles.qrCard}>
              <Card.Content style={styles.cardContent}>
                <Image 
                  source={{ uri: userData.YourQrCodeToMakeOnline }} 
                  style={styles.existingQrImage}
                  resizeMode="contain"
                />
                
                <View style={styles.statusContainer}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                  <Text style={styles.statusText}>QR Code Active</Text>
                </View>
              </Card.Content>
            </Card>

            <Button
              mode="outlined"
              onPress={handleChangeQr}
              style={styles.changeButton}
              icon="qrcode-edit"
            >
              Change QR Code
            </Button>

            <Button
              mode="contained"
              onPress={() => navigation.navigate('Home')}
              style={styles.homeButton}
            >
              Continue to Home
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show uploader (either first time or changing existing QR)
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {userData?.YourQrCodeToMakeOnline ? 'Update Payment QR Code' : 'Upload Payment QR Code'}
          </Text>
          <Text style={styles.subtitle}>
            {userData?.YourQrCodeToMakeOnline 
              ? 'Upload a new QR code to replace your current one'
              : 'Please upload a clear image of your payment QR code'
            }
          </Text>

          {userData?.YourQrCodeToMakeOnline && (
            <View style={styles.currentQrContainer}>
              <Text style={styles.currentQrLabel}>Current QR Code:</Text>
              <Image 
                source={{ uri: userData.YourQrCodeToMakeOnline }} 
                style={styles.currentQrPreview}
                resizeMode="contain"
              />
            </View>
          )}

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
                <Text style={styles.placeholderText}>
                  {userData?.YourQrCodeToMakeOnline ? 'Tap to select new QR code' : 'Tap to select QR code'}
                </Text>
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

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!image || loading}
              style={[styles.submitButton, (!image || loading) && styles.submitButtonDisabled]}
              loading={loading}
            >
              {userData?.YourQrCodeToMakeOnline ? 'Update QR Code' : 'Upload QR Code'}
            </Button>

            {userData?.YourQrCodeToMakeOnline && (
              <Button
                mode="outlined"
                onPress={handleCancelChange}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </View>
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
  qrCard: {
    width: '100%',
    marginBottom: 24,
    elevation: 2,
  },
  cardContent: {
    alignItems: 'center',
    padding: 20,
  },
  existingQrImage: {
    width: '100%',
    height: 250,
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    marginLeft: 8,
    color: '#10B981',
    fontWeight: '600',
  },
  changeButton: {
    width: '100%',
    marginBottom: 16,
    borderColor: '#6366F1',
  },
  homeButton: {
    width: '100%',
    paddingVertical: 8,
    backgroundColor: '#6366F1',
  },
  currentQrContainer: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  currentQrLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  currentQrPreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 8,
    backgroundColor: '#6366F1',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  cancelButton: {
    width: '100%',
    borderColor: '#9CA3AF',
  },
});