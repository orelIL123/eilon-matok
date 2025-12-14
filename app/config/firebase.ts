import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
    Auth,
    getAuth,
    getReactNativePersistence,
    initializeAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Your Firebase configuration
const firebaseConfig: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
} = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// measurementId is optional (only needed for Firebase Analytics)
if (process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID) {
  firebaseConfig.measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;
}

// בדיקת משתני סביבה חובה (measurementId הוא אופציונלי)
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
requiredKeys.forEach((key) => {
  if (!firebaseConfig[key]) {
    throw new Error(`Missing required Firebase env variable: ${key}`);
  }
});

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with proper React Native persistence
let auth: Auth;

if (Platform.OS !== 'web') {
  // For React Native - use persistence with AsyncStorage
  try {
    // Initialize with AsyncStorage persistence using getReactNativePersistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
    console.log('✅ Firebase Auth (app/config): Initialized with AsyncStorage persistence');
  } catch (error: any) {
    // If auth already initialized, get the existing instance
    if (error.code === 'auth/already-initialized') {
      auth = getAuth(app);
      console.log('✅ Firebase Auth (app/config): Using existing auth instance');
    } else {
      console.warn('⚠️ Firebase Auth (app/config): InitializeAuth failed, falling back to getAuth:', error);
      auth = getAuth(app);
    }
  }
} else {
  // For web - use default persistence
  auth = getAuth(app);
  console.log('✅ Firebase Auth (app/config): Initialized for web');
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Firebase Collections
export const collections = {
  users: 'users',
  appointments: 'appointments',
  barbers: 'barbers',
  treatments: 'treatments',
  gallery: 'gallery',
  waitlist: 'waitlist',
  settings: 'settings',
} as const;

// Type definitions for Firebase data
export interface User {
  uid: string;
  name: string;
  phone: string;
  photoURL?: string;
  createdAt: any;
  type: 'client' | 'barber' | 'admin';
}

export interface Appointment {
  appointmentId: string;
  clientId: string;
  barberId: string;
  treatmentId: string;
  date: string;
  time: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: any;
}

export interface Barber {
  barberId: string;
  name: string;
  photo?: string;
  availableSlots: string[];
  availabilityWindow: {
    start: string;
    end: string;
  };
}

export interface Treatment {
  treatmentId: string;
  title: string;
  price: number;
  duration: number;
  image: string;
}

export interface GalleryImage {
  imageId: string;
  url: string;
  uploadedBy: string;
  timestamp: any;
}

export interface WaitlistEntry {
  waitlistId: string;
  clientId: string;
  requestedDate: string;
  requestedTime: string;
  treatmentId: string;
  status: 'waiting' | 'notified' | 'removed';
  createdAt: any;
}

export interface Settings {
  maxBookingDaysAhead: number;
  showGallery: boolean;
  homepageBanner: string;
}

export default app; 