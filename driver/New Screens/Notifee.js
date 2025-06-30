import { View, Button, Text } from 'react-native';
import React from 'react';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';

export default function NotifeeComponent() {
    async function onDisplayNotification() {
        try {
            // Request permission (iOS & Android 13+)
            await notifee.requestPermission();

            // Create a high priority channel for driver notifications
            const channelId = await notifee.createChannel({
                id: 'driver_notifications',
                name: 'Driver Notifications',
                importance: AndroidImportance.HIGH,
                visibility: AndroidVisibility.PUBLIC,
                sound: 'default',
                vibration: true,
            });

            // Display notification
            await notifee.displayNotification({
                title: 'New Ride Request',
                body: 'You have a new ride request nearby',
                android: {
                    channelId,
                    smallIcon: 'ic_launcher',
                    importance: AndroidImportance.HIGH,
                    pressAction: {
                        id: 'default',
                    },
                    actions: [
                        {
                            title: 'Accept',
                            pressAction: {
                                id: 'accept',
                            },
                        },
                        {
                            title: 'Decline',
                            pressAction: {
                                id: 'decline',
                            },
                        },
                    ],
                },
            });
        } catch (error) {
            console.error('Notification error:', error);
        }
    }

    return (
        <View style={{ padding: 20 }}>
            <Text>Driver Notification Demo</Text>
            <Button title="Test Ride Notification" onPress={onDisplayNotification} />
        </View>
    );
}