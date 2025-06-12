import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { Platform, Alert } from "react-native";

// Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // ✅ Play sound
    shouldSetBadge: false,
  }),
});

export default function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState(null); // ✅ Token state
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token); // ✅ Save token to state
        console.log("Expo Push Token:", token);
      }
    });

    // Listener for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification Received:", notification);
    });

    // Listener for user interaction with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification Response:", response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // Function to send a push notification
  const sendPushNotification = async (title, body) => {
    if (!expoPushToken) {
      Alert.alert("No Token", "Push token is not available yet.");
      return;
    }

    const message = {
      to: expoPushToken,
      sound: "default", // 🔔 Play default sound
      title: title,
      body: body,
      data: { someData: "goes here" },
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  };

  return { expoPushToken, sendPushNotification }; // ✅ Return token and function
}

// Function to register for push notifications
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android" || Platform.OS === "ios") {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      Alert.alert("Permission Required", "Failed to get push token for notifications!");
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } else {
    Alert.alert("Unsupported Platform", "Push notifications only work on iOS and Android devices.");
    return null;
  }
}
