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
  Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Animated, {
  FadeInUp,
  FadeOutDown,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

// Document definitions
const DOCUMENTS = [
  { id: 'dl', title: 'Driver\'s License', label: 'Driver\'s License', icon: 'car-outline' },
  { id: 'rc', title: 'Registration Certificate', label: 'RC', icon: 'document-text-outline' },
  { id: 'insurance', title: 'Insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
  { id: 'aadharFront', title: 'aadharFront', label: 'Front Side Of Aadhar', icon: 'id-card-outline' },
  { id: 'aadharBack', title: 'aadharBack', label: 'Back Side Of Aadhar', icon: 'id-card-outline' },
  { id: 'pancard', title: 'pancard', label: 'Pan Card', icon: 'card-outline' },
  { id: 'profile', title: 'profile', label: 'Profile Image', icon: 'person' },
];

const API_URL = 'http://192.168.1.6:3100/api/v1/rider/rider-upload';
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB in bytes

export default function Documents() {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});
  const [fileSizeError, setFileSizeError] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const router = useNavigation();

  // Animation values
  const shake = useSharedValue(0);
  const fadeAnim = useSharedValue(0);

  // Check if all required documents are uploaded
  const isAllUploaded = DOCUMENTS.every(doc =>
    images[doc.id] && !fileSizeError[doc.id]
  );

  // Shake animation for errors
  const shakeAnimation = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shake.value }],
    };
  });

  // Fade in/out animation for success
  const fadeAnimation = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  });

  // Function to trigger shake animation
  const startShake = () => {
    shake.value = withSequence(
      withTiming(10, { duration: 50 }),
      withRepeat(withTiming(-10, { duration: 100 }), 3),
      withTiming(0, { duration: 50 })
    );
  };

  // Function to check file size
  const checkFileSize = async (uri) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return {
        size: fileInfo.size,
        isOverLimit: fileInfo.size > MAX_FILE_SIZE
      };
    } catch (error) {
      console.error("Error checking file size:", error);
      return { size: 0, isOverLimit: false };
    }
  };

  // Format file size to a human-readable format
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Image picking function with size validation
  const pickImage = async (type) => {
    try {
      setLoading(prev => ({ ...prev, [type]: true }));
      setError(prev => ({ ...prev, [type]: null }));
      setFileSizeError(prev => ({ ...prev, [type]: false }));

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        setError(prev => ({
          ...prev,
          [type]: 'Permission to access media library was denied'
        }));
        startShake();
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;

        // Check file size
        const { size, isOverLimit } = await checkFileSize(uri);

        if (isOverLimit) {
          setFileSizeError(prev => ({ ...prev, [type]: true }));
          setError(prev => ({
            ...prev,
            [type]: `File size (${formatFileSize(size)}) exceeds limit of 1MB`
          }));
          setImages(prev => ({ ...prev, [type]: uri }));
          startShake();
        } else {
          // Simulate upload progress
          setUploadProgress(prev => ({ ...prev, [type]: 0 }));
          const interval = setInterval(() => {
            setUploadProgress(prev => {
              const current = prev[type] || 0;
              if (current >= 100) {
                clearInterval(interval);
                return prev;
              }
              return { ...prev, [type]: current + 10 };
            });
          }, 200);

          // Simulate network delay to show progress
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Success
          setImages(prev => ({ ...prev, [type]: uri }));
          setUploadProgress(prev => ({ ...prev, [type]: 100 }));
          setFileSizeError(prev => ({ ...prev, [type]: false }));

          // Animate success
          fadeAnim.value = withSequence(
            withTiming(1, { duration: 300 }),
            withTiming(0, { duration: 300, delay: 1500 })
          );
        }
      }
    } catch (err) {
      setError(prev => ({ ...prev, [type]: err.message }));
      startShake();
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token_cab');
      router.navigate('Onboarding');
      console.log("Logout successful");
    } catch (error) {
      console.log("Logout Error:", error);
    }
  };

  // Submit all documents
  const handleSubmit = async () => {
    if (!isAllUploaded) return;

    try {
      setLoading(prev => ({ ...prev, submit: true }));

      // Get authentication token
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Create FormData for upload
      const formData = new FormData();

      // Append each image to FormData with its document type
      Object.entries(images).forEach(([docType, uri]) => {
        if (fileSizeError[docType]) return; // Skip files that are too large

        // Get file extension from URI
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append('documents', {
          uri: uri,
          name: `${docType}.${fileType}`,
          type: `image/${fileType}`,
        });

        // Also append document type
        formData.append('documentTypes', docType);
      });

      // Make API request with progress tracking
      const response = await axios.post(API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(prev => ({ ...prev, submit: percentCompleted }));
        },
      });

      if (response.data.success) {
        Alert.alert(
          'Success',
          'Documents uploaded successfully!',
          [{ text: 'OK' }]
        );
        setError('')
        // Navigate to waiting screen or next step
        router.navigate('Wait_Screen');
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (err) {
      console.log("Error during submission:", err.response);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to submit documents';
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
      setError(prev => ({ ...prev, submit: errorMessage }));
      startShake();
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
      setUploadProgress(prev => ({ ...prev, submit: 0 }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Document Upload</Text>
        <Text style={styles.subtitle}>
          Please upload clear photos of your documents
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.loginButton}
        >
          <Text style={styles.loginButtonText}>
            Login
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.documentsContainer}>
          {DOCUMENTS.map((doc, index) => (
            <Animated.View
              key={doc.id}
              entering={SlideInRight.delay(index * 100)}
              style={styles.documentCard}
            >
              <Text style={styles.documentLabel}>
                {doc.label}
              </Text>

              <Animated.View style={[shakeAnimation]}>
                <TouchableOpacity
                  style={[
                    styles.uploadArea,
                    images[doc.id] && !fileSizeError[doc.id] && styles.uploadAreaSuccess,
                    fileSizeError[doc.id] && styles.uploadAreaError,
                    error[doc.id] && !fileSizeError[doc.id] && styles.uploadAreaError,
                  ]}
                  onPress={() => pickImage(doc.id)}
                  disabled={loading[doc.id]}
                >
                  {loading[doc.id] ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#007AFF" size="large" />
                      <Text style={styles.loadingText}>Uploading...</Text>
                      {uploadProgress[doc.id] !== undefined && (
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressBar,
                              { width: `${uploadProgress[doc.id]}%` }
                            ]}
                          />
                          <Text style={styles.progressText}>
                            {uploadProgress[doc.id]}%
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : images[doc.id] ? (
                    <View style={styles.previewContainer}>
                      <Image
                        source={{ uri: images[doc.id] }}
                        style={styles.preview}
                      />
                      <View style={[
                        styles.overlay,
                        fileSizeError[doc.id] && styles.overlayError
                      ]}>
                        {fileSizeError[doc.id] ? (
                          <Ionicons name="close-circle" size={32} color="#FF3B30" />
                        ) : (
                          <Animated.View style={[fadeAnimation]}>
                            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                          </Animated.View>
                        )}
                        <Text style={[
                          styles.overlayText,
                          fileSizeError[doc.id] && styles.overlayTextError
                        ]}>
                          {fileSizeError[doc.id] ? 'File too large' : 'Tap to change'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.placeholderContainer}>
                      <Ionicons name={doc.icon} size={36} color="#666" />
                      <Text style={styles.documentTitle}>{doc.label}</Text>
                      <Text style={styles.uploadText}>Tap to upload</Text>
                      <Text style={styles.fileSizeText}>Max size: 1MB</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {error[doc.id] && (
                <Animated.Text
                  style={styles.errorText}
                  entering={FadeInUp}
                  exiting={FadeOutDown}
                >
                  {error[doc.id]}
                </Animated.Text>
              )}
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!isAllUploaded || loading.submit) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!isAllUploaded || loading.submit}
      >
        {loading.submit ? (
          <View style={styles.submitLoadingContainer}>
            <ActivityIndicator color="#FFF" size="small" />
            {uploadProgress.submit !== undefined && (
              <Text style={styles.submitProgressText}>
                Uploading... {uploadProgress.submit}%
              </Text>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.submitButtonText}>Submit Documents</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </>
        )}
      </TouchableOpacity>

      {error.submit && (
        <Animated.Text
          style={[styles.errorText, styles.submitErrorText]}
          entering={FadeInUp}
          exiting={FadeOutDown}
        >
          {error.submit}
        </Animated.Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  loginButton: {
    backgroundColor: '#0d6efd',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  documentsContainer: {
    padding: 20,
  },
  documentCard: {
    marginBottom: 24,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  documentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  uploadArea: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E1E4E8',
    borderStyle: 'dashed',
    overflow: 'hidden',
    height: 160,
    backgroundColor: '#F9FAFB',
  },
  uploadAreaSuccess: {
    borderColor: '#4CAF50',
    borderStyle: 'solid',
  },
  uploadAreaError: {
    borderColor: '#FF3B30',
    borderStyle: 'solid',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 4,
  },
  uploadText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  fileSizeText: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    width: '80%',
    height: 8,
    backgroundColor: '#E1E4E8',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    fontSize: 12,
    color: '#007AFF',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  preview: {
    flex: 1,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayError: {
    backgroundColor: 'rgba(255, 200, 200, 0.85)',
  },
  overlayText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  overlayTextError: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 122, 255, 0.2)',
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  submitLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitProgressText: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 8,
  },
  submitErrorText: {
    textAlign: 'center',
    marginBottom: 20,
  },
});