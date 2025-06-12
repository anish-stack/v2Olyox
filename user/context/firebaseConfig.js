import firebase from '@react-native-firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyA-mGbVdZs1VXF24aUPZaXkJgMTo7BDa4Y',
  authDomain: 'olyox-6215a.firebaseapp.com',
  projectId: 'olyox-6215a',
  storageBucket: 'olyox-6215a.appspot.com',
  messagingSenderId: '900366491123',
  databaseURL: 'https://olyox-6215a.firebaseio.com',
  appId: '1:900366491123:android:0ecb86eff4c628c3ecc686',
};

if (!firebase.apps.length) {
  console.log('✅ Firebase not initialized. Initializing now...');
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully.');
} else {
  console.log('✅ Firebase already initialized.');
}

export default firebase;
