import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

async function startFloatingBubble() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      NativeModules.BubbleModule.startBubbleService();
    } else {
      console.log('Permission denied');
    }
  }
}

startFloatingBubble();
