import { View, StyleSheet } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { Video } from 'expo-av';
import { tokenCache } from '../Auth/cache';
import { useNavigation } from '@react-navigation/native';

export default function SplashScreen() {
  const [isLogin, setIsLogin] = useState(null);
  const navigation = useNavigation();
  const videoRef = useRef(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const db_token = await tokenCache.getToken('auth_token_db');
        setIsLogin(db_token !== null);
      } catch (error) {
        console.error('Error fetching tokens:', error);
        setIsLogin(false);
      }
    };

    checkLoginStatus();
  }, []);

  const handleVideoEnd = () => {
    if (isLogin === true) {
      navigation.replace('Home'); // change 'Home' to your screen name
    } else {
      navigation.replace('Onboarding'); // change to your onboarding screen
    }
  };


  if (isLogin === null) {
    return null; // or show a loader if needed
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../assets/splash.mp4')}
        rate={2.5}
        
        isMuted={true}
        resizeMode="cover"
        shouldPlay
        onPlaybackStatusUpdate={(status) => {
          if (status.didJustFinish) {
            handleVideoEnd();
          }
        }}
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  video: {
    flex: 1,
  },
});
