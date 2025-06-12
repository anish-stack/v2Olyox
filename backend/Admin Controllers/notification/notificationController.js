const PushToken = require("../../models/PushNotification/PushTokenForCabAndParcel");


exports.registerToken = async (req, res) => {
  try {
    const { userId, pushToken } = req.body;
console.log("i am token of push",req.body)
    // Check if the token already exists for this user
    const existingToken = await PushToken.findOne({ userId });

    if (existingToken) {
      existingToken.pushToken = pushToken;
      await existingToken.save();
      return res.status(200).json({ message: 'Push token updated successfully' });
    }

    const newToken = new PushToken({ userId, pushToken });
    await newToken.save();
    res.status(201).json({ message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    const userToken = await PushToken.findOne({ userId });

    if (!userToken) {
      return res.status(404).json({ error: 'User not found or push token not registered' });
    }

    const message = {
      to: userToken.pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    };

    // Send the notification using Expo's push notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseData = await response.json();
    console.log('Push notification response:', responseData);

    if (responseData.errors) {
      console.error('Error sending notification:', responseData.errors);
      return res.status(500).json({ error: 'Failed to send push notification', details: responseData.errors });
    }

    res.status(200).json({ message: 'Push notification sent successfully', response: responseData });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
};