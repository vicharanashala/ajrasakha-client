import firebase from 'firebase/app';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { logger } from '@librechat/data-schemas';
import type { FirebaseStorage } from 'firebase/storage';
import type { FirebaseApp } from 'firebase/app';

let firebaseInitCount = 0;
let firebaseApp: FirebaseApp | null = null;
let firebaseStorage: FirebaseStorage | null = null;

export const initializeFirebase = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  if (Object.values(firebaseConfig).some((value) => !value)) {
    if (firebaseInitCount === 0) {
      logger.info(
        '[Optional] Firebase CDN not initialized. To enable, set FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, and FIREBASE_APP_ID environment variables.',
      );
    }
    firebaseInitCount++;
    return null;
  }

  firebaseApp = firebase.initializeApp(firebaseConfig);
  logger.info('Firebase CDN initialized');
  return firebaseApp;
};

export const getFirebaseStorage = (): FirebaseStorage | null => {
  if (firebaseStorage) {
    return firebaseStorage;
  }

  const app = initializeFirebase();
  if (!app) {
    return null;
  }

  firebaseStorage = getStorage(app);

  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (emulatorHost) {
    const [host, port] = emulatorHost.split(':');
    connectStorageEmulator(firebaseStorage, host, Number(port));
    logger.info(`Firebase Storage connected to emulator at ${emulatorHost}`);
  }

  return firebaseStorage;
};
