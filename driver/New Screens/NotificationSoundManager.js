import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Linking,
  FlatList,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

const NotificationSoundManager = ({ visible, onClose, onSoundSelected }) => {
  const [sounds, setSounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [playingSound, setPlayingSound] = useState(null);
  const [soundObject, setSoundObject] = useState(null);

  // Available notification sounds in your app
  const availableSounds = [
    {
      id: 'notification_1',
      name: 'Classic Bell',
      url: 'https://your-app-domain.com/sounds/notification_bell.mp3',
      fileName: 'notification_bell.mp3',
    },
    {
      id: 'notification_2',
      name: 'Chime',
      url: 'https://your-app-domain.com/sounds/notification_chime.mp3',
      fileName: 'notification_chime.mp3',
    },
    {
      id: 'notification_3',
      name: 'Ding',
      url: 'https://your-app-domain.com/sounds/notification_ding.mp3',
      fileName: 'notification_ding.mp3',
    },
    {
      id: 'notification_4',
      name: 'Alert Tone',
      url: 'https://your-app-domain.com/sounds/notification_alert.mp3',
      fileName: 'notification_alert.mp3',
    },
  ];

  useEffect(() => {
    if (visible) {
      checkDownloadedSounds();
    }
    return () => {
      if (soundObject) {
        soundObject.unloadAsync();
      }
    };
  }, [visible]);

  const checkDownloadedSounds = async () => {
    setLoading(true);
    try {
      const updatedSounds = await Promise.all(
        availableSounds.map(async (sound) => {
          const localUri = FileSystem.documentDirectory + sound.fileName;
          const fileInfo = await FileSystem.getInfoAsync(localUri);
          return {
            ...sound,
            isDownloaded: fileInfo.exists,
            localUri: fileInfo.exists ? localUri : null,
          };
        })
      );
      setSounds(updatedSounds);
    } catch (error) {
      console.error('Error checking downloaded sounds:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadSound = async (sound) => {
    try {
      setDownloading(sound.id);
      
      // Request permissions for Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission needed', 'Storage permission is required to download sounds');
          return;
        }
      }

      const localUri = FileSystem.documentDirectory + sound.fileName;
      
      // Download the sound file
      const downloadResult = await FileSystem.downloadAsync(sound.url, localUri);
      
      if (downloadResult.status === 200) {
        // Update the sound in state
        setSounds(prevSounds =>
          prevSounds.map(s =>
            s.id === sound.id
              ? { ...s, isDownloaded: true, localUri: downloadResult.uri }
              : s
          )
        );
        
        Alert.alert('Success', `${sound.name} downloaded successfully!`);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download sound. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const playSound = async (sound) => {
    try {
      // Stop any currently playing sound
      if (soundObject) {
        await soundObject.unloadAsync();
        setSoundObject(null);
      }

      if (playingSound === sound.id) {
        setPlayingSound(null);
        return;
      }

      const { sound: newSoundObject } = await Audio.Sound.createAsync(
        { uri: sound.localUri },
        { shouldPlay: true }
      );

      setSoundObject(newSoundObject);
      setPlayingSound(sound.id);

      // Auto-stop after playing
      newSoundObject.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingSound(null);
          newSoundObject.unloadAsync();
          setSoundObject(null);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
      Alert.alert('Error', 'Could not play sound');
    }
  };

  const setAsNotificationSound = async (sound) => {
    if (Platform.OS === 'android') {
      try {
    
        Alert.alert(
          'Sound Added',
          `${sound.name} has been added to your device. You can now set it as your notification sound in Settings.`,
          [
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
              },
            },
            { text: 'Later' },
          ]
        );
      } catch (error) {
        console.error('Error setting notification sound:', error);
        Alert.alert('Error', 'Could not set notification sound');
      }
    } else {
      // iOS - Create custom notification channel
      try {
        await Notifications.setNotificationChannelAsync('custom_sound', {
          name: 'Custom Sound',
          importance: Notifications.AndroidImportance.HIGH,
          sound: sound.fileName,
          vibrationPattern: [0, 250, 250, 250],
        });
        
        Alert.alert(
          'Custom Sound Set',
          `${sound.name} will be used for app notifications.`,
          [{ text: 'OK' }]
        );
        
        onSoundSelected?.(sound);
      } catch (error) {
        console.error('Error setting iOS notification sound:', error);
        Alert.alert('Error', 'Could not set notification sound');
      }
    }
  };

  const openSystemSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.SOUND_SETTINGS');
    } else {
      Linking.openURL('app-settings:');
    }
  };

  const renderSoundItem = ({ item }) => (
    <View style={styles.soundItem}>
      <View style={styles.soundInfo}>
        <Text style={styles.soundName}>{item.name}</Text>
        <Text style={styles.soundStatus}>
          {item.isDownloaded ? 'Downloaded' : 'Not downloaded'}
        </Text>
      </View>
      
      <View style={styles.soundActions}>
        {!item.isDownloaded ? (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => downloadSound(item)}
            disabled={downloading === item.id}
          >
            {downloading === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => playSound(item)}
            >
              <Ionicons 
                name={playingSound === item.id ? "pause" : "play"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.setButton}
              onPress={() => setAsNotificationSound(item)}
            >
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              <Text style={styles.setButtonText}>Set</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notification Sounds</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          Download and set custom notification sounds for your app.
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>Loading sounds...</Text>
          </View>
        ) : (
          <FlatList
            data={sounds}
            renderItem={renderSoundItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.soundsList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openSystemSettings}
          >
            <Ionicons name="settings-outline" size={20} color="#007bff" />
            <Text style={styles.settingsButtonText}>
              Open System Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  soundsList: {
    paddingHorizontal: 20,
  },
  soundItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  soundStatus: {
    fontSize: 12,
    color: '#666',
  },
  soundActions: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  setButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  settingsButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '500',
  },
});

export default NotificationSoundManager;