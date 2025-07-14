import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const NotificationPermissionModal = ({ 
  visible: externalVisible, 
  onClose: externalOnClose, 
  onRetry, 
  onAllow, 
  autoClose = true, 
  permissionGranted = false,
  refreshNavigation = true
}) => {
  
  const [internalVisible, setInternalVisible] = useState(false);
  const visible = externalVisible !== undefined ? externalVisible : internalVisible;
  const navigation = useNavigation();
  
  // Don't render modal if permission is granted
  if (permissionGranted) {
    return null;
  }
  
  // Internal close function
  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalVisible(false);
    }
    
    // Refresh navigation stack if enabled
    if (refreshNavigation && navigation) {
      try {
        // Reset navigation stack to refresh the current screen
        navigation.reset({
          index: 0,
          routes: [{ name: navigation.getState().routes[navigation.getState().index].name }],
        });
      } catch (error) {
        console.log('Navigation refresh error:', error);
      }
    }
  };
  
  // Function to show modal (can be called externally)
  const showModal = () => {
    setInternalVisible(true);
  };
  
  // Auto-close effect when permission is granted
  useEffect(() => {
    if (autoClose && permissionGranted && visible) {
      // Small delay to show success state before closing
      const timer = setTimeout(() => {
        handleClose();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoClose, permissionGranted, visible]);

  const handleOpenSettings = () => {
    Alert.alert(
      "Open Settings",
      "To enable notifications, please go to Settings > Notifications and allow notifications for this app.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]
    );
  };

  const handleAllowNotifications = async () => {
    try {
      await onRetry();
      // If onAllow is provided, call it after retry
      if (onAllow) {
        onAllow();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={60} color="#FF6B6B" />
          </View>
          
          <Text style={styles.title}>Enable Notifications</Text>
          
          <Text style={styles.message}>
            Please allow notifications to receive ride requests and important updates. 
            Without notifications, you might miss new ride opportunities.
          </Text>
          
          <View style={styles.bulletPoints}>
            <View style={styles.bulletPoint}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Get instant ride requests</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Receive important updates</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.bulletText}>Never miss opportunities</Text>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAllowNotifications}
            >
              <Text style={styles.primaryButtonText}>Allow Notifications</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleOpenSettings}
            >
              <Text style={styles.secondaryButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Text style={styles.closeButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  bulletPoints: {
    alignSelf: 'stretch',
    marginBottom: 25,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bulletText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#555',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 14,
  },
});

export default NotificationPermissionModal;

// Export the showModal function for external use
export { NotificationPermissionModal };