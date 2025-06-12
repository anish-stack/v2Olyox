const admin = require("firebase-admin");
const { FIREBASE_CREDENTIALS_BASE64 } = require("./Key");

// Custom error classes for more specific error handling
class FirebaseInitializationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FirebaseInitializationError';
  }
}

class NotificationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
  }
}

// Logging utility
const logger = {
  info: (message) => console.log(`ℹ️ ${message}`),
  warn: (message) => console.warn(`⚠️ ${message}`),
  error: (message) => console.error(`❌ ${message}`),
  debug: (message) => console.debug(`🐛 ${message}`)
};

const initializeFirebase = () => {
  if (admin.apps && admin.apps.length > 0) {
    logger.info('Firebase already initialized');
    return admin;
  }

  try {
    const credentialConfig = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CERT_URL
    };

    admin.initializeApp({
      credential: admin.credential.cert(credentialConfig),
      databaseURL: process.env.FIREBASE_DATABASE_URL  // <-- here
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return admin;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.error('Service account file could not be read');
    } else if (error.code === 'app/invalid-credential') {
      logger.error('Invalid Firebase credentials. Check service account.');
    } else {
      logger.error(`Unexpected Firebase Init Error: ${error.message}`);
    }
    logger.error('Firebase initialization failed');
    throw error;
  }
};



// Rest of the code remains the same...
const sendNotification = async (token, title, body, eventData = {}) => {
  try {
    // Validate input
    if (!token) {
      throw new NotificationError(
        'No FCM token provided',
        'INVALID_TOKEN'
      );
    }

    // Ensure Firebase is initialized
    try {
      initializeFirebase();
    } catch (initError) {
      throw new NotificationError(
        'Failed to initialize Firebase',
        'INIT_FAILED'
      );
    }

    // Default notification content
    const defaultTitle = "👑 Royal Proclamation!";
    const defaultBody = "Hear ye, hear ye! Anish and Manish have ascended the throne. All hail the kings who rule with wisdom, strength, and unstoppable swag! 👑🔥🦁";

    // Prepare notification message
    const message = {
      token: token,
      notification: {
        title: title || defaultTitle,
        body: body || defaultBody,
      },
      data: {
        // Ensure all data values are strings
        event: eventData.event || "DEFAULT_EVENT",
        ...Object.fromEntries(
          Object.entries(eventData).map(([k, v]) => [k, String(v)])
        ),
      },
    };

    // Send notification
    const response = await admin.messaging().send(message);

    logger.info(`Notification sent successfully: ${response}`);
    return response;

  } catch (error) {
    // Detailed error handling
    switch (error.code) {
      case 'messaging/invalid-argument':
        logger.warn(`Invalid FCM message argument: ${error.message}`);
        break;
      case 'messaging/invalid-recipient':
        logger.warn(`Invalid FCM token (${token.substring(0, 10)}...)`);
        break;
      case 'app/invalid-credential':
        logger.error('Firebase credential error. Check service account.');
        break;
      case 'INIT_FAILED':
        logger.error('Firebase initialization failed');
        break;
      case 'INVALID_TOKEN':
        logger.warn('No FCM token provided');
        break;
      default:
        logger.error(`Notification send failed: ${error.message}`);
    }

    // Rethrow or return null based on error type
    if (error instanceof NotificationError) {
      return null;
    }
    throw error;
  }
};

// Test hook for direct module execution
if (require.main === module) {
  const testToken = process.env.TEST_FCM_TOKEN;
  if (testToken) {
    sendNotification(testToken, "Test Notification", "This is a test notification")
      .then(() => logger.info("Test notification completed"))
      .catch(logger.error);
  }
}

module.exports = {
  initializeFirebase,
  sendNotification,
};
