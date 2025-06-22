import {
  showFloatingBubble,
  requestPermission,
  checkPermission,
  initialize
} from "react-native-floating-bubble";
import { Alert, Linking, Platform } from 'react-native';

const safeInit = async () => {
  try {
    const hasPermission = await checkPermission();
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "You must enable overlay permission manually in settings.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return;
      }
    }

    await initialize();
    await showFloatingBubble(10, 10);
    console.log("Floating bubble shown");
  } catch (err) {
    console.error("❌ Failed to init bubble:", err);
  }
};
