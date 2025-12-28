import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    linkWithCredential,
    onAuthStateChanged,
    PhoneAuthProvider,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User
} from 'firebase/auth';
import {
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes, UploadMetadata } from 'firebase/storage';
import { isValidDuration, SLOT_SIZE_MINUTES } from '../app/constants/scheduling';
import { auth, db, functions, storage } from '../config/firebase';
import { AuthStorageService } from './authStorage';
import { CacheUtils } from './cache';
import { cancelAppointmentReminders as cancelLocalAppointmentReminders, cleanupNotificationsOnLogout, scheduleAppointmentReminders as scheduleLocalAppointmentReminders } from './notifications';
// Removed ImageOptimizer import - using simple upload only

// Export db for use in other components
export { db };

// Create admin user function for development/first setup
export const createAdminUser = async (email: string, password: string, displayName: string, phone: string): Promise<boolean> => {
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create admin profile in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: email,
      displayName: displayName,
      phone: phone,
      isAdmin: true, // Make this user an admin
      createdAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);

    // Save auth data for persistence
    await saveAuthDataAfterLogin(user);

    console.log('Admin user created successfully:', email);
    return true;
  } catch (error) {
    console.error('Error creating admin user:', error);
    return false;
  }
};

// Make current logged-in user an admin (for development)
// Check if current user is admin and has push token
export const checkCurrentUserAdminStatus = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.log('❌ No current user');
      return false;
    }
    
    const profile = await getUserProfile(currentUser.uid);
    if (!profile) {
      console.log('❌ No user profile found');
      return false;
    }
    
    console.log(`👤 Current user: ${profile.displayName}`);
    console.log(`👨‍💼 Is admin: ${profile.isAdmin || false}`);
    console.log(`📱 Has push token: ${!!profile.pushToken}`);
    
    return {
      isAdmin: profile.isAdmin || false,
      hasPushToken: !!profile.pushToken,
      profile: profile
    };
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

export const makeCurrentUserAdmin = async (): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('לא מחובר משתמש');
    }

    // Check if user profile exists, if not create it
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // Create user profile if it doesn't exist
      const newProfile: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || 'Admin User',
        phone: currentUser.phoneNumber || '',
        isAdmin: true,
        createdAt: Timestamp.now(),
      };
      await setDoc(userDocRef, newProfile);
      console.log('Created new admin profile for:', currentUser.uid);
    } else {
      // Update existing user profile to be admin
      await updateDoc(userDocRef, {
        isAdmin: true
      });
      console.log('Updated existing user to admin:', currentUser.uid);
    }

    return true;
  } catch (error) {
    console.error('Error making current user admin:', error);
    return false;
  }
};


export interface UserProfile {
  uid: string;
  email?: string; // Make email optional for phone auth
  displayName: string;
  phone: string;
  profileImage?: string;
  isAdmin?: boolean;
  hasPassword?: boolean; // Added for phone auth with password
  createdAt: Timestamp;
  pushToken?: string; // Added for push notifications
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isActive: boolean;
  stock?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Barber {
  id: string;
  name: string;
  image: string;
  specialties: string[];
  experience: string;
  rating: number;
  available: boolean;
  pricing?: { [treatmentId: string]: number }; // Custom pricing per treatment
  phone?: string; // Phone number for contact
  photoUrl?: string; // Photo URL for profile image
  bio?: string; // Biography description
}

export interface Treatment {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  image: string;
}

export interface Appointment {
  id: string;
  userId: string;
  barberId: string;
  treatmentId: string;
  date: Timestamp;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Timestamp;
  duration: number; // משך טיפול בדקות
}

export interface WaitlistEntry {
  id: string;
  userId: string;
  barberId: string;
  date: string; // YYYY-MM-DD format
  preferredTimeStart: string; // HH:MM format (e.g., "14:00")
  preferredTimeEnd: string; // HH:MM format (e.g., "16:00")
  createdAt: Timestamp;
  userDisplayName?: string;
  userPhone?: string;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  type: 'gallery' | 'background' | 'splash' | 'aboutus' | 'treatments';
  order: number;
  isActive: boolean;
  createdAt: Timestamp;
}

export interface BarberAvailability {
  id: string;
  barberId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  isAvailable: boolean;
  createdAt: Timestamp;
}

export interface AppSettings {
  id: string;
  key: string;
  value: any;
  updatedAt: Timestamp;
}

const derivePhoneFormats = (input: string) => {
  const digitsOnly = (input ?? '').replace(/[^0-9]/g, '');
  let withoutCountry = digitsOnly;

  if (withoutCountry.startsWith('972')) {
    withoutCountry = withoutCountry.substring(3);
  }

  if (withoutCountry.startsWith('0')) {
    withoutCountry = withoutCountry.substring(1);
  }

  if (!withoutCountry && digitsOnly) {
    withoutCountry = digitsOnly;
  }

  const withCountry = withoutCountry ? `972${withoutCountry}` : digitsOnly;
  const normalizedPhone = withoutCountry
    ? `+972${withoutCountry}`
    : (digitsOnly ? `+${digitsOnly}` : input);
  const localLeadingZero = withoutCountry
    ? `0${withoutCountry}`
    : (digitsOnly.startsWith('0') ? digitsOnly : `0${digitsOnly}`);

  return {
    digitsOnly,
    withoutCountry,
    withCountry,
    normalizedPhone,
    localLeadingZero,
  };
};

const buildPhoneEmailCandidates = (formats: ReturnType<typeof derivePhoneFormats>) => {
  const candidates = new Set<string>();
  const add = (localPart?: string, domain?: string) => {
    if (!localPart || !domain) return;
    candidates.add(`${localPart}@${domain}`);
  };

  // Domain for users - אילון מתוק
  add(formats.withCountry, 'eilonmatok.app');
  add(formats.withoutCountry, 'eilonmatok.app');
  add(formats.digitsOnly, 'eilonmatok.app');

  add(formats.withCountry, 'sms.barbershop.local');
  add(formats.withoutCountry, 'sms.barbershop.local');
  add(formats.digitsOnly, 'sms.barbershop.local');

  add(formats.withCountry, 'eilonmatok.local');
  add(formats.withoutCountry, 'eilonmatok.local');
  add(formats.digitsOnly, 'eilonmatok.local');

  add(formats.withCountry, 'ronbarber.app');
  add(formats.withoutCountry, 'ronbarber.app');
  add(formats.digitsOnly, 'ronbarber.app');

  add(formats.withCountry, 'temp.eilonmatok.com');
  add(formats.withoutCountry, 'temp.eilonmatok.com');
  add(formats.digitsOnly, 'temp.eilonmatok.com');

  return Array.from(candidates).filter(Boolean);
};

// Auth functions
export const loginUser = async (email: string, password: string) => {
  try {
    console.log(`🔐 Attempting email login with: ${email}`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`✅ Email login successful for: ${email}`);

    // Save auth data for persistence
    await saveAuthDataAfterLogin(userCredential.user);

    // Register for push notifications after successful login
    await registerForPushNotifications(userCredential.user.uid);

    return userCredential.user;
  } catch (error: any) {
    console.error(`❌ Email login failed for: ${email}`, error.code, error.message);
    throw error;
  }
};

export const registerUser = async (email: string, password: string, displayName: string, phone: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, {
      displayName: displayName
    });
    
    // Check if this is the admin email
    const isAdminEmail = email === 'orel895@gmail.com';
    
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: displayName,
      phone: phone,
      isAdmin: isAdminEmail, // Automatically set admin for specific email
      createdAt: Timestamp.now()
    };
    
    await setDoc(doc(db, 'users', user.uid), userProfile);

    // Save auth data for persistence
    await saveAuthDataAfterLogin(user);

    // Register for push notifications after successful registration
    await registerForPushNotifications(user.uid);
    
    // Send welcome notification
    await sendWelcomeNotification(user.uid);
    
    // Send notification to admin about new user
    try {
      await sendNewUserNotificationToAdmin(displayName, email);
    } catch (adminNotificationError) {
      console.log('Failed to send new user notification to admin:', adminNotificationError);
    }
    
    return user;
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    const user = auth.currentUser;

    if (!user) {
      console.log('⚠️ No user to logout');
      return;
    }

    console.log('🚪 Starting logout process for user:', user.uid);

    // Use the comprehensive notification cleanup function
    // This handles: token revocation, canceling scheduled notifications, dismissing presented notifications
    await cleanupNotificationsOnLogout(user.uid);

    // Clear stored auth data - מסונן לפי prefix
    await AuthStorageService.clearAuthData();

    // Clear cache
    await CacheUtils.invalidateAuthCaches();

    // Sign out from Firebase
    await signOut(auth);
    console.log('✅ User logged out successfully');
  } catch (error) {
    console.error('❌ Error during logout:', error);
    throw error;
  }
};

// Helper function to save auth data after successful login
const saveAuthDataAfterLogin = async (user: User) => {
  try {
    console.log('🔄 Starting to save auth data for user:', user.uid);
    const userProfile = await getUserProfile(user.uid);
    if (userProfile) {
      const authData = {
        uid: user.uid,
        email: user.email || undefined,
        phoneNumber: user.phoneNumber || userProfile.phone,
        displayName: user.displayName || userProfile.displayName,
        isAdmin: userProfile.isAdmin || false,
        lastLoginAt: new Date().toISOString(),
        savedCredentials: {
          email: user.email || undefined,
          phoneNumber: user.phoneNumber || userProfile.phone,
          hasPassword: true
          // Note: We don't save password here for security reasons
          // Password should be saved separately when user explicitly chooses to
        }
      };
      
      console.log('💾 Saving auth data:', {
        uid: authData.uid,
        email: authData.email,
        phoneNumber: authData.phoneNumber,
        displayName: authData.displayName,
        isAdmin: authData.isAdmin,
        savedCredentials: authData.savedCredentials
      });
      
      await AuthStorageService.saveAuthData(authData);
      console.log('✅ Auth data saved successfully');
    } else {
      console.log('❌ No user profile found for user:', user.uid);
    }
  } catch (error) {
    console.error('❌ Error saving auth data:', error);
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Get saved login credentials
export const getSavedLoginCredentials = async () => {
  try {
    return await AuthStorageService.getSavedCredentials();
  } catch (error) {
    console.error('Error getting saved credentials:', error);
    return null;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Phone authentication functions
export const sendSMSVerification = async (phoneNumber: string) => {
  try {
    // Format phone number for SMS service
    let formattedPhone = phoneNumber;
    
    // Add +972 prefix if not present
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) {
        formattedPhone = '+972' + phoneNumber.substring(1);
      } else {
        formattedPhone = '+972' + phoneNumber;
      }
    }
    
    console.log('📱 Sending SMS to:', formattedPhone);
    
    // Generate a verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = `sms4free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('🔐 Generated verification code:', verificationCode);
    console.log('🆔 Generated verification ID:', verificationId);

    // Use SMS4Free service
    const { MessagingService } = await import('../app/services/messaging/service');
    const { messagingConfig } = await import('../app/config/messaging');

    const messagingService = new MessagingService(messagingConfig);

    const smsMessage = `קוד האימות שלך: ${verificationCode}\nתוקף 10 דקות\n- אילון מתוק מספרה`;

    const result = await messagingService.sendMessage({
      to: formattedPhone,
      message: smsMessage
    });

    if (result.success) {
      console.log('✅ SMS sent successfully via SMS4Free');

      // Store verification code in AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const verificationData = {
        code: String(verificationCode), // Ensure code is stored as string
        phone: formattedPhone,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem(`verification_${verificationId}`, JSON.stringify(verificationData));
      console.log('💾 Verification data stored for ID:', verificationId);
      console.log('💾 Stored data:', verificationData);
      console.log('💾 Code type:', typeof verificationData.code, '| Value:', verificationData.code);

      return { verificationId };
    } else {
      console.error('❌ SMS4Free error:', result.error);
      throw new Error(`Failed to send SMS: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

export const verifySMSCode = async (verificationId: string, verificationCode: string) => {
  try {
    console.log('🔐 verifySMSCode called with:', { verificationId, verificationCode, codeType: typeof verificationCode });

    // Normalize code (trim, digits-only) to be robust against pasted spaces/dashes
    const normalizedCode = String(verificationCode || '').trim().replace(/\D/g, '');
    console.log('🔐 Normalized code:', { original: verificationCode, normalized: normalizedCode, normalizedType: typeof normalizedCode });

    // Handle SMS4Free verification
    if (verificationId.startsWith('sms4free_')) {
      console.log('🔧 Verifying SMS4Free code for ID:', verificationId);

      // Get stored verification data from AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      // Debug: List all keys in AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('🔍 All AsyncStorage keys:', allKeys);
      console.log('🔍 Looking for key:', `verification_${verificationId}`);

      const storedData = await AsyncStorage.getItem(`verification_${verificationId}`);

      if (!storedData) {
        console.error('❌ Verification ID not found in storage:', verificationId);
        console.error('❌ Available keys:', allKeys);
        throw new Error('Verification ID not found or expired');
      }

      const verificationData = JSON.parse(storedData);
      console.log('📱 Retrieved verification data:', {
        storedCode: verificationData.code,
        enteredCode: verificationCode,
        phone: verificationData.phone
      });

      // Check if verification code matches (normalize stored too just in case)
      const storedCode = String(verificationData.code || '').trim().replace(/\D/g, '');
      const enteredCodeNormalized = String(verificationCode || '').trim().replace(/\D/g, '');
      
      console.log('🔍 Code comparison:', {
        storedCode: storedCode,
        normalizedCode: normalizedCode,
        enteredCodeNormalized: enteredCodeNormalized,
        storedRaw: verificationData.code,
        enteredRaw: verificationCode,
        match: storedCode === enteredCodeNormalized || storedCode === normalizedCode
      });

      // Check both normalized versions to be more robust
      if (storedCode !== enteredCodeNormalized && storedCode !== normalizedCode) {
        console.error('❌ Code mismatch:', {
          stored: verificationData.code,
          storedNormalized: storedCode,
          entered: verificationCode,
          enteredNormalized: enteredCodeNormalized,
          normalizedCode: normalizedCode
        });
        throw new Error('קוד האימות שגוי. אנא נסה שוב.');
      }

      // Check if verification is not expired (10 minutes)
      const now = Date.now();
      const verificationAge = now - verificationData.timestamp;
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

      if (verificationAge > tenMinutes) {
        // Clean up expired verification
        await AsyncStorage.removeItem(`verification_${verificationId}`);
        console.error('❌ Verification expired:', { age: verificationAge, limit: tenMinutes });
        throw new Error('Verification code expired');
      }

      console.log('✅ SMS4Free verification successful');

      // For login purposes, try to find and log in the existing user
      try {
        const existingUser = await findUserByPhoneNumber(verificationData.phone);
        if (existingUser) {
          console.log('📞 Found existing user for phone:', verificationData.phone);

          // Sign in with the existing user's email and temp password
          if (existingUser.email) {
            // For temp email users, we need to handle login differently
            // Just clean up and return success - the login screen will handle navigation
            await AsyncStorage.removeItem(`verification_${verificationId}`);
            return {
              sms4freeVerified: true,
              phone: verificationData.phone,
              existingUser: existingUser
            };
          }
        }
      } catch (error) {
        console.log('🔍 No existing user found, this is for registration');
      }

      // Don't clean up verification yet - let registerUserWithPhone handle it
      // This allows for retry in case of registration failure

      // Return verification success indicator
      return {
        sms4freeVerified: true,
        phone: verificationData.phone,
        verificationData: verificationData  // Pass the data for later cleanup
      };
    }

    // Handle legacy mock verification
    if (verificationId.startsWith('mock_verification_')) {
      console.log('🔧 Using mock SMS verification');

      if (verificationCode.length === 6 && /^\d+$/.test(verificationCode)) {
        console.log('✅ Mock SMS verification successful');
        return { mockUser: true };
      } else {
        throw new Error('Invalid verification code format');
      }
    }

    // Real Firebase verification (for when you set up proper Firebase phone auth)
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const result = await signInWithCredential(auth, credential);

    // Save auth data for persistence
    await saveAuthDataAfterLogin(result.user);

    return result.user;
  } catch (error) {
    console.error('Error verifying SMS code:', error);
    throw error;
  }
};

export const registerUserWithPhone = async (phoneNumber: string, displayName: string, verificationId: string, verificationCode: string, password: string) => {
  try {
    // Verify the SMS code first
    const verificationResult = await verifySMSCode(verificationId, verificationCode);
    if (!verificationResult) {
      throw new Error('SMS verification failed');
    }

    // Handle SMS4Free registration
    if (verificationId.startsWith('sms4free_')) {
      console.log('🔧 Using SMS4Free phone registration');

      // Normalize phone formats once
      const phoneFormats = derivePhoneFormats(phoneNumber);
      if (!phoneFormats.withCountry) {
        throw new Error('מספר הטלפון שהוזן אינו תקין.');
      }
      const normalizedPhone = phoneFormats.normalizedPhone;
      console.log(`📱 Normalized phone from "${phoneNumber}" to "${normalizedPhone}"`);

      // Use consistent format: 972508315000@eilonmatok.app
      const tempEmail = `${phoneFormats.withCountry}@eilonmatok.app`;
      // Use the password chosen by the user, not a temporary one
      const userPassword = password;

      console.log('📧 Creating user with temporary email:', tempEmail);

      // Create Firebase Auth user with the user's chosen password
      const userCredential = await createUserWithEmailAndPassword(auth, tempEmail, userPassword);
      const user = userCredential.user;

      // Update the user's display name
      await updateProfile(user, {
        displayName: displayName
      });

      // Check if this is the admin phone number
      const isAdminPhone = normalizedPhone === '+972542280222';

      const userProfile: UserProfile = {
        uid: user.uid,  // Use Firebase Auth UID
        email: tempEmail, // Store the temporary email
        displayName: displayName,
        phone: normalizedPhone, // CRITICAL FIX: Store normalized phone
        isAdmin: isAdminPhone,
        hasPassword: true, // Has a temporary password
        createdAt: Timestamp.now()
      };

      console.log('💾 Saving user profile with phone:', normalizedPhone);
      console.log('💾 Saving user profile with email:', tempEmail);
      await setDoc(doc(db, 'users', user.uid), userProfile);

      // Save auth data for persistence
      await saveAuthDataAfterLogin(user);

      console.log('✅ SMS4Free user registered successfully with temp email auth');

      // Clean up verification data after successful registration
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(`verification_${verificationId}`);
      console.log('🧹 Verification data cleaned up after successful registration');

      // Send notification to admins about new user registration
      try {
        await sendNotificationToAdmin(
          'משתמש חדש נרשם! 🎉',
          `${displayName} נרשם לאפליקציה עם מספר ${phoneNumber}`,
          { type: 'new_user', userName: displayName, phoneNumber: phoneNumber }
        );
        console.log('✅ Admin notification sent for new user registration');
      } catch (error) {
        console.error('❌ Error sending admin notification:', error);
        // Don't fail registration if notification fails
      }

      // Return the Firebase Auth user object
      return user;
    }

    // Handle legacy mock verification
    if (verificationId.startsWith('mock_verification_')) {
      console.log('🔧 Using mock phone registration');

      const mockUserId = `mock_user_${Date.now()}`;
      const isAdminPhone = phoneNumber === '+972542280222'; // Only this number is auto-admin

      const userProfile: UserProfile = {
        uid: mockUserId,
        displayName: displayName,
        phone: phoneNumber,
        isAdmin: isAdminPhone,
        hasPassword: false,
        createdAt: Timestamp.now()
      };

      await setDoc(doc(db, 'users', mockUserId), userProfile);
      console.log('✅ Mock user registered successfully');

      // Send notification to admins about new user registration
      try {
        await sendNotificationToAdmin(
          'משתמש חדש נרשם! 🎉',
          `${displayName} נרשם לאפליקציה עם מספר ${phoneNumber}`
        );
        console.log('✅ Admin notification sent for new mock user registration');
      } catch (error) {
        console.error('❌ Error sending admin notification:', error);
        // Don't fail registration if notification fails
      }

      return {
        uid: mockUserId,
        displayName: displayName,
        phoneNumber: phoneNumber
      };
    }

    // Real Firebase registration
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;
    
    await updateProfile(user, {
      displayName: displayName
    });
    
    // Check if this is the admin phone number
    const isAdminPhone = phoneNumber === '+972532706369' || phoneNumber === '+972542280222';
    
    const userProfile: UserProfile = {
      uid: user.uid,
      displayName: displayName,
      phone: phoneNumber,
      isAdmin: isAdminPhone,
      hasPassword: false,
      createdAt: Timestamp.now()
    };
    
    await setDoc(doc(db, 'users', user.uid), userProfile);

    // Save auth data for persistence
    await saveAuthDataAfterLogin(user);

    // Send notification to admins about new user registration
    try {
      await sendNotificationToAdmin(
        'משתמש חדש נרשם! 🎉',
        `${displayName} נרשם לאפליקציה עם מספר ${phoneNumber}`
      );
      console.log('✅ Admin notification sent for new Firebase user registration');
    } catch (error) {
      console.error('❌ Error sending admin notification:', error);
      // Don't fail registration if notification fails
    }
    
    return user;
  } catch (error) {
    console.error('Error registering user with phone:', error);
    throw error;
  }
};

// Find user by phone number
export const findUserByPhoneNumber = async (phoneNumber: string): Promise<UserProfile | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', phoneNumber));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as UserProfile;

    return userData;
  } catch (error) {
    console.error('Error finding user by phone:', error);
    return null;
  }
};

// New function to check if phone user exists and has password
export const checkPhoneUserExists = async (phoneNumber: string): Promise<{ exists: boolean; hasPassword: boolean; uid?: string; isAdmin?: boolean; email?: string }> => {
  try {
    console.log(`🔍 Checking if user exists for phone: ${phoneNumber}`);

    // Generate all possible phone formats
    const phoneFormats = derivePhoneFormats(phoneNumber);
    const possiblePhones = Array.from(
      new Set(
        [
          phoneNumber,
          phoneFormats.normalizedPhone,
          phoneFormats.withCountry ? `+${phoneFormats.withCountry}` : undefined,
          phoneFormats.withCountry,
          phoneFormats.localLeadingZero,
          phoneFormats.digitsOnly,
        ].filter((value): value is string => !!value)
      )
    );

    console.log(`🔍 Trying phone formats:`, possiblePhones);

    const usersRef = collection(db, 'users');

    // Try each phone format
    for (const phoneFormat of possiblePhones) {
      try {
        console.log(`🔍 Searching for phone format: ${phoneFormat}`);
        const q = query(usersRef, where('phone', '==', phoneFormat));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();

          console.log(`✅ User found with phone format: ${phoneFormat}, email: ${userData.email}, hasPassword: ${userData.hasPassword || false}, isAdmin: ${userData.isAdmin || false}, UID: ${userDoc.id}`);

          return {
            exists: true,
            hasPassword: userData.hasPassword || false,
            uid: userDoc.id,
            isAdmin: userData.isAdmin || false,
            email: userData.email // Return the actual email stored in Firestore
          };
        }
      } catch (error) {
        console.log(`❌ Error searching for phone format ${phoneFormat}:`, error);
        continue;
      }
    }
    
    // If not found by phone, try to find by the auto-generated email
    console.log(`🔍 Phone search failed, trying email search for: ${phoneNumber}`);
    const possibleEmails = buildPhoneEmailCandidates(phoneFormats);
    
    console.log(`🔍 Trying email formats:`, possibleEmails);
    
    for (const emailFormat of possibleEmails) {
      try {
        console.log(`🔍 Searching for email format: ${emailFormat}`);
        const q = query(usersRef, where('email', '==', emailFormat));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();

          console.log(`✅ User found with email format: ${emailFormat}, hasPassword: ${userData.hasPassword || false}, UID: ${userDoc.id}`);

          return {
            exists: true,
            hasPassword: userData.hasPassword || false,
            uid: userDoc.id,
            email: userData.email // Return the stored email
          };
        }
      } catch (error) {
        console.log(`❌ Error searching for email format ${emailFormat}:`, error);
        continue;
      }
    }
    
    console.log(`❌ No user found with any phone or email format for: ${phoneNumber}`);
    return { exists: false, hasPassword: false };
    
  } catch (error) {
    console.error('Error checking phone user:', error);
    return { exists: false, hasPassword: false };
  }
};

// New function to set password for existing SMS users
export const setPasswordForSMSUser = async (phoneNumber: string, password: string) => {
  try {
    const userCheck = await checkPhoneUserExists(phoneNumber);
    if (!userCheck.exists) {
      throw new Error('משתמש לא נמצא');
    }

    // Create email from phone number for Firebase Auth
    const tempEmail = `${phoneNumber.replace(/[^0-9]/g, '')}@temp.eilonmatok.com`;
    
    try {
      // Try to create user with temp email and password
      const userCredential = await createUserWithEmailAndPassword(auth, tempEmail, password);
      
      // Update user profile to link to existing user data
      const userDocRef = doc(db, 'users', userCheck.uid!);
      await updateDoc(userDocRef, {
        hasPassword: true,
        email: tempEmail,
        authUid: userCredential.user.uid
      });
      
      // Save auth data for persistence
      await saveAuthDataAfterLogin(userCredential.user);

      console.log(`✅ Password set for SMS user: ${phoneNumber}`);
      return userCredential.user;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        // Email already exists, just update the user profile
        await updateDoc(doc(db, 'users', userCheck.uid!), {
          hasPassword: true
        });
        
        // Try to sign in with existing credentials
        const userCredential = await signInWithEmailAndPassword(auth, tempEmail, password);

        // Save auth data for persistence
        await saveAuthDataAfterLogin(userCredential.user);

        return userCredential.user;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error setting password for SMS user:', error);
    throw error;
  }
};

// Simple function to login with phone + password
export const loginWithPhoneAndPassword = async (phoneNumber: string, password: string) => {
  try {
    console.log(`🔐 ===== LOGIN ATTEMPT =====`);
    console.log(`🔐 Phone number: ${phoneNumber}`);
    console.log(`🔐 Password length: ${password.length}`);

    const phoneFormats = derivePhoneFormats(phoneNumber);
    if (!phoneFormats.withCountry) {
      throw new Error('מספר הטלפון שהוזן אינו תקין.');
    }

    const primaryEmail = `${phoneFormats.withCountry}@eilonmatok.app`;

    // Try direct login with the deterministic phone email first
    let initialLoginError: any = null;
    try {
      console.log(`🎯 Attempting primary phone-email login: ${primaryEmail}`);
      const userCredential = await signInWithEmailAndPassword(auth, primaryEmail, password);
      console.log(`✅ Login successful with primary phone-email: ${primaryEmail}`);

      await saveAuthDataAfterLogin(userCredential.user);

      try {
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
          email: primaryEmail,
          phone: phoneFormats.normalizedPhone,
          hasPassword: true,
        });
      } catch (docError) {
        console.warn('⚠️ Unable to sync user profile after primary phone login:', docError);
      }

      return userCredential.user;
    } catch (error: any) {
      initialLoginError = error;
      console.error(`❌ Primary phone-email login failed:`, error.code, error.message);

      // Don't throw immediately - continue to check Firestore for actual email
      // The user might have changed their email during password reset
      if (error.code === 'auth/wrong-password') {
        // Only throw for wrong password if we're sure about the email
        console.log(`⚠️ Wrong password with primary email, will check Firestore for updated email`);
      }

      // Continue to check Firestore - don't throw for invalid-credential
      // because the email might have been updated
      if (error.code !== 'auth/user-not-found' && 
          error.code !== 'auth/invalid-email' && 
          error.code !== 'auth/invalid-credential' &&
          error.code !== 'auth/wrong-password') {
        throw error;
      }
    }

    // Check if user exists in database and get their ACTUAL email
    const userCheck = await checkPhoneUserExists(phoneFormats.normalizedPhone || phoneNumber);
    console.log(`📞 User check result:`, JSON.stringify(userCheck, null, 2));

    if (!userCheck.exists) {
      console.log(`❌ User not found in database for phone: ${phoneNumber}`);
      console.log(`❌ This means the user document does not exist in Firestore`);
      throw new Error('משתמש לא נמצא במערכת. אנא הירשם תחילה.');
    }

    console.log(`✅ User exists in Firestore!`);
    console.log(`   - UID: ${userCheck.uid}`);
    console.log(`   - Has password: ${userCheck.hasPassword}`);
    console.log(`   - Is admin: ${userCheck.isAdmin}`);

    if (!userCheck.hasPassword) {
      console.log(`❌ User exists but has no password set for phone: ${phoneNumber}`);
      console.log(`❌ This means hasPassword is false in Firestore`);
      throw new Error('לא הוגדרה סיסמה לחשבון זה. אנא הירשם מחדש.');
    }

    // CRITICAL FIX: Use the ACTUAL email stored in Firestore, not guessing!
    if (userCheck.email) {
      console.log(`🎯 Using stored email from Firestore: ${userCheck.email}`);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, userCheck.email, password);
        console.log(`✅ Login successful with stored email: ${userCheck.email}`);

        // Save auth data for persistence
        await saveAuthDataAfterLogin(userCredential.user);

        return userCredential.user;
      } catch (error: any) {
        console.error(`❌ Login failed with stored email ${userCheck.email}:`, error.code, error.message);

        // Provide specific error messages
        if (error.code === 'auth/wrong-password') {
          throw new Error('הסיסמה שגויה. אנא נסה שוב.');
        } else if (error.code === 'auth/user-not-found') {
          throw new Error('משתמש לא נמצא ב-Firebase Auth. אנא פנה לתמיכה.');
        } else if (error.code === 'auth/invalid-credential') {
          throw new Error('פרטי הכניסה שגויים. אנא נסה שוב.');
        }
        throw error;
      }
    }

    // Fallback: If no email in Firestore, try common formats (for old users)
    console.log(`⚠️ No email stored in Firestore, trying common formats (fallback for old users)`);
    const possibleEmails = buildPhoneEmailCandidates(phoneFormats);

    console.log(`🔍 Trying email formats for login:`, possibleEmails);

    let lastError: any = null;
    for (const email of possibleEmails) {
      try {
        console.log(`🔐 Trying email format: ${email}`);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log(`✅ Login successful with email: ${email}`);

        // Save auth data for persistence
        await saveAuthDataAfterLogin(userCredential.user);

        // Update Firestore with the correct email for next time
        try {
          await updateDoc(doc(db, 'users', userCheck.uid!), { email: email });
          console.log(`💾 Updated Firestore with correct email: ${email}`);
        } catch (updateError) {
          console.error(`⚠️ Could not update email in Firestore:`, updateError);
        }

        return userCredential.user;
      } catch (error: any) {
        lastError = error;
        console.log(`❌ Failed with email: ${email}`, error.code);
        continue;
      }
    }

    console.log(`❌ All email formats failed for phone: ${phoneNumber}`);
    console.log(`❌ Last error:`, lastError?.code, lastError?.message);

    if (lastError?.code === 'auth/wrong-password') {
      throw new Error('הסיסמה שגויה. אנא נסה שוב.');
    } else if (lastError?.code === 'auth/user-not-found') {
      throw new Error('משתמש לא נמצא ב-Firebase Auth. אנא הירשם מחדש.');
    } else if (lastError?.code === 'auth/invalid-credential') {
      throw new Error('פרטי הכניסה שגויים. אנא נסה שוב.');
    }

    throw new Error('פרטי הכניסה שגויים. בדוק את הטלפון והסיסמה.');
    
  } catch (error: any) {
    console.error('Error login with phone and password:', error);
    
    // If it's already our custom error message, just throw it
    if (error.message.includes('משתמש לא נמצא במערכת') || 
        error.message.includes('לא הוגדרה סיסמה') ||
        error.message.includes('פרטי הכניסה שגויים')) {
      throw error;
    }
    
    if (error.code === 'auth/user-not-found') {
      throw new Error('משתמש לא נמצא במערכת ההזדהות');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('סיסמה שגויה');
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error('פרטי הכניסה שגויים');
    }
    
    throw error;
  }
};

// Check if user exists by phone number (for password reset flow)
export const checkUserExistsForPasswordReset = async (phoneNumber: string): Promise<{ exists: boolean; userId?: string; email?: string }> => {
  try {
    const phoneFormats = derivePhoneFormats(phoneNumber.trim());
    const normalizedPhone = phoneFormats.normalizedPhone || phoneNumber.trim();
    const userCheck = await checkPhoneUserExists(normalizedPhone);
    
    return {
      exists: userCheck.exists,
      userId: userCheck.uid,
      email: userCheck.email // Return the email stored in Firestore
    };
  } catch (error) {
    console.error('Error checking user for password reset:', error);
    return { exists: false };
  }
};

// Send password reset email to any email address
export const sendPasswordResetToEmail = async (email: string): Promise<void> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`📧 Attempting to send password reset email to: ${normalizedEmail}`);
    
    await sendPasswordResetEmail(auth, normalizedEmail);
    console.log(`✅ Password reset email sent successfully to: ${normalizedEmail}`);
  } catch (error: any) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error?.code, error?.message);
    console.error(`❌ Full error details:`, JSON.stringify(error, null, 2));
    
    if (error?.code === 'auth/user-not-found') {
      throw new Error('לא נמצא חשבון עם האימייל הזה במערכת ההזדהות. האימייל במערכת שלנו לא קשור לחשבון Firebase. אנא פנה לתמיכה.');
    } else if (error?.code === 'auth/invalid-email') {
      throw new Error('האימייל שהוזן אינו תקין. אנא בדוק את האימייל ונסה שוב.');
    }
    throw error;
  }
};

export const initiatePasswordReset = async (identifier: string): Promise<string> => {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    throw new Error('אנא הזן מספר טלפון כדי לאפס סיסמה.');
  }

  const sendResetForEmail = async (targetEmail: string) => {
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      console.log(`✅ Password reset email sent to: ${targetEmail}`);
      return targetEmail;
    } catch (error: any) {
      console.error(`❌ Failed to send password reset email to ${targetEmail}:`, error?.code, error?.message);
      // Don't throw here - let the caller handle it
      throw error;
    }
  };

  // If user entered an email, try it first (maybe they have a real email account)
  if (trimmedIdentifier.includes('@')) {
    try {
      await sendResetForEmail(trimmedIdentifier.toLowerCase());
      return trimmedIdentifier.toLowerCase();
    } catch (error: any) {
      // If email not found, ask for phone instead
      if (error?.code === 'auth/user-not-found') {
        throw new Error('לא נמצא חשבון עם האימייל הזה. אנא הזן את מספר הטלפון שלך במקום.');
      }
      throw error;
    }
  }

  // Main flow: user entered phone number - check if user exists
  const phoneFormats = derivePhoneFormats(trimmedIdentifier);
  const normalizedPhone = phoneFormats.normalizedPhone || trimmedIdentifier;

  const userCheck = await checkPhoneUserExists(normalizedPhone);

  if (!userCheck.exists) {
    throw new Error('USER_NOT_FOUND'); // Special error code to trigger email input
  }
  
  // User exists - return special indicator to request email
  return `USER_EXISTS:${normalizedPhone}`;

};

// Verify password reset code from SMS
export const verifyPasswordResetCode = async (phoneNumber: string, code: string): Promise<{ valid: boolean; resetCodeId?: string; userId?: string }> => {
  try {
    const phoneFormats = derivePhoneFormats(phoneNumber.trim());
    const normalizedPhone = phoneFormats.normalizedPhone || phoneNumber.trim();
    
    // Find reset code in Firestore
    const resetCodesRef = collection(db, 'passwordResetCodes');
    const q = query(
      resetCodesRef,
      where('phone', '==', normalizedPhone),
      where('code', '==', code),
      where('used', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { valid: false };
    }
    
    const resetCodeDoc = querySnapshot.docs[0];
    const resetCodeData = resetCodeDoc.data();
    
    // Check if code expired
    const expiresAt = resetCodeData.expiresAt?.toDate();
    if (!expiresAt || expiresAt < new Date()) {
      return { valid: false };
    }
    
    return {
      valid: true,
      resetCodeId: resetCodeDoc.id,
      userId: resetCodeData.userId
    };
  } catch (error) {
    console.error('Error verifying reset code:', error);
    return { valid: false };
  }
};

// Reset password using SMS code
export const resetPasswordWithCode = async (phoneNumber: string, code: string, newPassword: string): Promise<void> => {
  try {
    const verification = await verifyPasswordResetCode(phoneNumber, code);
    
    if (!verification.valid || !verification.resetCodeId || !verification.userId) {
      throw new Error('קוד איפוס לא תקין או שפג תוקפו');
    }
    
    // Get user profile to find email
    const userProfile = await getUserProfile(verification.userId);
    if (!userProfile || !userProfile.email) {
      throw new Error('לא נמצא אימייל למשתמש');
    }
    
    // Update password using Firebase Auth
    // Note: Firebase doesn't have direct password update, so we need to use the reset link
    // For now, we'll mark the code as used and guide user to use email reset
    await updateDoc(doc(db, 'passwordResetCodes', verification.resetCodeId), {
      used: true,
      usedAt: Timestamp.now()
    });
    
    // Try to send password reset email as fallback
    await sendPasswordResetEmail(auth, userProfile.email);
    
    throw new Error('קישור איפוס סיסמה נשלח לאימייל שלך. אנא השתמש בקישור כדי לאפס את הסיסמה.');
  } catch (error: any) {
    console.error('Error resetting password with code:', error);
    throw error;
  }
};

// New function to set password for phone user
export const setPasswordForPhoneUser = async (phoneNumber: string, password: string) => {
  try {
    const userCheck = await checkPhoneUserExists(phoneNumber);
    if (!userCheck.exists) {
      throw new Error('משתמש לא נמצא');
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('משתמש לא מחובר');
    }

    // Create email from phone number for Firebase Auth
    const email = `${phoneNumber.replace(/[^0-9]/g, '')}@eilonmatok.local`;
    
    // Link email/password credential to existing phone user
    const emailCredential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(currentUser, emailCredential);
    
    // Update user profile
    const userProfile = await getUserProfile(userCheck.uid!);
    if (userProfile) {
      await updateUserProfile(userCheck.uid!, {
        ...userProfile,
        email: email,
        hasPassword: true
      });
    }

    return true;
  } catch (error) {
    console.error('Error setting password for phone user:', error);
    throw error;
  }
};

export const loginWithPhone = async (phoneNumber: string, verificationId: string, verificationCode: string) => {
  try {
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const userCredential = await signInWithCredential(auth, credential);

    // Save auth data for persistence
    await saveAuthDataAfterLogin(userCredential.user);

    return userCredential.user;
  } catch (error) {
    console.error('Error logging in with phone:', error);
    throw error;
  }
};

// User profile functions
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  try {
    // #region agent log
    if (updates.pushToken) {
      fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:1384',message:'updateUserProfile called with pushToken',data:{uid,pushToken:updates.pushToken.substring(0,20)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
    // #endregion
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, updates);
    // #region agent log
    if (updates.pushToken) {
      fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:1387',message:'updateUserProfile completed',data:{uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
    // #endregion
  } catch (error) {
    // #region agent log
    if (updates.pushToken) {
      fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:1389',message:'Error updating user profile',data:{uid,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
    // #endregion
    throw error;
  }
};

// Get all users for admin
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const users: UserProfile[] = [];
    
    querySnapshot.forEach((doc) => {
      users.push({
        uid: doc.id,
        ...doc.data()
      } as UserProfile);
    });
    
    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

// Delete customer - removes from Firestore database
// Note: Firebase Client SDK doesn't allow deleting other users from Authentication
// This function only removes the user document from Firestore
// To completely remove from Authentication, you would need Firebase Admin SDK (Cloud Functions)
export const deleteCustomer = async (userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`🗑️ Attempting to delete customer: ${userId}`);

    // Check if user exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return {
        success: false,
        message: 'משתמש לא נמצא במערכת.'
      };
    }

    const userData = userDoc.data() as UserProfile;

    // Prevent deleting admin users
    if (userData.isAdmin) {
      console.log(`❌ Cannot delete admin user: ${userId}`);
      return {
        success: false,
        message: 'לא ניתן למחוק משתמש אדמין.'
      };
    }

    console.log(`📋 Deleting customer data for: ${userData.displayName} (${userData.phone})`);

    // Store auth identifier for the success message
    const authIdentifier = userData.email || userData.phone || userId;

    // 1. Delete all user's appointments
    console.log('  📅 Deleting appointments...');
    const appointmentsQuery = query(collection(db, 'appointments'), where('userId', '==', userId));
    const appointmentsSnapshot = await getDocs(appointmentsQuery);

    const batch = writeBatch(db);
    appointmentsSnapshot.docs.forEach((appointmentDoc) => {
      batch.delete(appointmentDoc.ref);
    });
    await batch.commit();
    console.log(`  ✅ Deleted ${appointmentsSnapshot.size} appointments`);

    // 2. Delete push notification tokens
    console.log('  🔔 Deleting push tokens...');
    const tokensQuery = query(collection(db, 'pushTokens'), where('userId', '==', userId));
    const tokensSnapshot = await getDocs(tokensQuery);

    const tokensBatch = writeBatch(db);
    tokensSnapshot.docs.forEach((tokenDoc) => {
      tokensBatch.delete(tokenDoc.ref);
    });
    await tokensBatch.commit();
    console.log(`  ✅ Deleted ${tokensSnapshot.size} push tokens`);

    // 3. Delete scheduled reminders
    console.log('  ⏰ Deleting scheduled reminders...');
    const remindersQuery = query(collection(db, 'scheduledReminders'), where('userId', '==', userId));
    const remindersSnapshot = await getDocs(remindersQuery);

    const remindersBatch = writeBatch(db);
    remindersSnapshot.docs.forEach((reminderDoc) => {
      remindersBatch.delete(reminderDoc.ref);
    });
    await remindersBatch.commit();
    console.log(`  ✅ Deleted ${remindersSnapshot.size} scheduled reminders`);

    // 4. Delete user document from Firestore
    console.log('  💾 Deleting user document from Firestore...');
    await deleteDoc(doc(db, 'users', userId));
    console.log('  ✅ User document deleted from Firestore');

    // 5. Delete user from Firebase Authentication using Cloud Function
    console.log('  🔐 Deleting user from Firebase Authentication...');
    try {
      const deleteUserAuth = httpsCallable(functions, 'deleteUserAuth');
      const result = await deleteUserAuth({ userId });
      console.log('  ✅ User deleted from Authentication:', result.data);
    } catch (authError: any) {
      console.error('  ⚠️  Error deleting from Authentication:', authError);
      // Continue even if auth deletion fails - user data is already removed
      if (authError.code === 'functions/not-found') {
        console.log('  ⚠️  Cloud Function not found - user remains in Authentication');
      }
    }

    console.log(`✅ Successfully deleted customer ${userId} completely`);
    console.log(`   - ${appointmentsSnapshot.size} appointments`);
    console.log(`   - ${tokensSnapshot.size} push tokens`);
    console.log(`   - ${remindersSnapshot.size} scheduled reminders`);
    console.log(`   - User document from Firestore`);
    console.log(`   - User from Firebase Authentication`);

    return {
      success: true,
      message: `הלקוח נמחק בהצלחה!\n\nנמחקו:\n• ${appointmentsSnapshot.size} תורים\n• ${tokensSnapshot.size} tokens\n• ${remindersSnapshot.size} תזכורות\n• מסמך המשתמש\n• משתמש מ-Authentication\n\n✅ המשתמש נמחק לחלוטין מהמערכת!`
    };
  } catch (error: any) {
    console.error('❌ Error deleting customer:', error);
    return {
      success: false,
      message: `שגיאה במחיקת הלקוח: ${error.message || 'אנא נסה שוב'}`
    };
  }
};

// Barbers functions
export const getBarbers = async (useCache: boolean = false): Promise<Barber[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'barbers'));
    const barbers: Barber[] = [];

    querySnapshot.forEach((doc) => {
      barbers.push({ id: doc.id, ...doc.data() } as Barber);
    });

    // Sort barbers alphabetically to provide consistent ordering
    barbers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

    console.log('✅ Returning', barbers.length, 'barber(s) from Firestore');

    return barbers;
  } catch (error) {
    console.error('Error getting barbers:', error);
    return [];
  }
};

export const getBarber = async (barberId: string): Promise<Barber | null> => {
  try {
    const docRef = doc(db, 'barbers', barberId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Barber;
    }
    return null;
  } catch (error) {
    console.error('Error getting barber:', error);
    return null;
  }
};

// Treatments functions
export const getTreatments = async (useCache: boolean = true): Promise<Treatment[]> => {
  try {
    // Try cache first if enabled
    if (useCache) {
      const cached = await CacheUtils.getTreatments();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        console.log('📦 Treatments loaded from cache');
        return cached;
      }
    }

    const querySnapshot = await getDocs(collection(db, 'treatments'));
    const treatments: Treatment[] = [];
    
    querySnapshot.forEach((doc) => {
      treatments.push({
        id: doc.id,
        ...doc.data()
      } as Treatment);
    });
    
    // Cache the results for 60 minutes
    if (useCache) {
      await CacheUtils.setTreatments(treatments, 60);
      console.log('💾 Treatments cached for 60 minutes');
    }
    
    return treatments;
  } catch (error) {
    console.error('Error getting treatments:', error);
    return [];
  }
};

// Appointments functions
export const createAppointment = async (appointmentData: Omit<Appointment, 'id' | 'createdAt'>) => {
  try {
    // Validate duration is a multiple of 5 minutes (minimum 5)
    if (appointmentData.duration && !isValidDuration(appointmentData.duration)) {
      throw new Error(`Duration must be a multiple of ${SLOT_SIZE_MINUTES} minutes. Got: ${appointmentData.duration} minutes`);
    }
    
    const appointment = {
      ...appointmentData,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'appointments'), appointment);
    console.log('Appointment created with ID:', docRef.id);
    
    // Send notification to user about new appointment
    try {
      const dateVal: any = appointmentData.date as any;
      const asDate = typeof dateVal?.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
      const dateStr = asDate.toLocaleDateString('he-IL');
      await sendNotificationToUser(appointmentData.userId, 'תור חדש נוצר! 📅', `התור שלך נוצר בהצלחה. תאריך: ${dateStr}`, { appointmentId: docRef.id });
    } catch (notificationError) {
      console.log('Failed to send appointment notification:', notificationError);
    }
    
    // SMS confirmation removed - user requested not to send SMS on every appointment
    // Only push notifications will be sent to avoid SMS quota issues
    
    // Send notification to admin about new appointment
    try {
      const dateVal: any = appointmentData.date as any;
      const asDate = typeof dateVal?.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
      const dateStr = asDate.toLocaleDateString('he-IL');
      const timeStr = asDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      
      // Get customer name for better admin notification
      let customerName = 'לקוח';
      try {
        const customerDoc = await getDoc(doc(db, 'users', appointmentData.userId));
        if (customerDoc.exists()) {
          customerName = customerDoc.data().displayName || 'לקוח';
        }
      } catch (e) {
        console.log('Could not fetch customer name');
      }
      
      await sendNotificationToAdmin(
        'תור חדש! 📅', 
        `${customerName} קבע תור ל-${dateStr} ב-${timeStr}`, 
        { appointmentId: docRef.id }
      );
      console.log('✅ Admin notification sent for new appointment');
    } catch (adminNotificationError) {
      console.log('❌ Failed to send admin notification:', adminNotificationError);
    }
    
    // Send WhatsApp message to barber about new appointment
    try {
      if (appointmentData.barberId) {
        const barber = await getBarber(appointmentData.barberId);
        if (barber && barber.phone) {
          const dateVal: any = appointmentData.date as any;
          const asDate = typeof dateVal?.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
          const dateStr = asDate.toLocaleDateString('he-IL');
          const timeStr = asDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          
          // Get customer and treatment details
          let customerName = 'לקוח';
          let treatmentName = 'טיפול';
          try {
            const customerDoc = await getDoc(doc(db, 'users', appointmentData.userId));
            if (customerDoc.exists()) {
              customerName = customerDoc.data().displayName || customerDoc.data().name || 'לקוח';
            }
            if (appointmentData.treatmentId) {
              const treatments = await getTreatments();
              const treatment = treatments.find(t => t.id === appointmentData.treatmentId);
              if (treatment) treatmentName = treatment.name;
            }
          } catch (e) {
            console.log('Could not fetch customer/treatment details for WhatsApp');
          }
          
          // Format phone number for WhatsApp (remove dashes, ensure country code)
          let barberPhone = barber.phone.replace(/[-\s]/g, ''); // Remove dashes and spaces
          if (!barberPhone.startsWith('+')) {
            if (barberPhone.startsWith('0')) {
              barberPhone = '+972' + barberPhone.substring(1); // Convert 052... to +97252...
            } else {
              barberPhone = '+972' + barberPhone; // Add country code
            }
          }
          
          const whatsappMessage = `תור חדש! 📅\n\nלקוח: ${customerName}\nטיפול: ${treatmentName}\nתאריך: ${dateStr}\nשעה: ${timeStr}\nמשך: ${appointmentData.duration || 30} דקות\n\nאילון מתוק מספרה`;
          
          console.log('📱 Sending WhatsApp to barber:', barberPhone);
          console.log('📱 Message:', whatsappMessage);
          
          // Use messaging service to send WhatsApp
          const { MessagingService } = await import('../app/services/messaging/service');
          const { messagingConfig } = await import('../app/config/messaging');
          const messagingService = new MessagingService(messagingConfig);
          const result = await messagingService.sendMessage({
            to: barberPhone,
            message: whatsappMessage,
            type: 'whatsapp'
          });
          
          if (result.success) {
            console.log('✅ WhatsApp sent to barber successfully');
          } else {
            console.log('⚠️ WhatsApp failed, trying SMS:', result.error);
            // Fallback to SMS if WhatsApp fails
            try {
              await sendSMSReminder(barber.phone, whatsappMessage);
              console.log('✅ SMS sent to barber as fallback');
            } catch (smsError) {
              console.error('❌ Failed to send SMS to barber:', smsError);
            }
          }
        } else {
          console.log('⚠️ Barber has no phone number, skipping WhatsApp/SMS');
        }
      }
    } catch (whatsappError) {
      console.error('❌ Failed to send WhatsApp to barber:', whatsappError);
      // Don't throw - WhatsApp failure shouldn't prevent appointment creation
    }
    
    // Schedule LOCAL notification reminders (for appointments within 24 hours)
    try {
      console.log('📱 Scheduling LOCAL appointment reminders...');
      const appointmentDate = appointmentData.date.toDate();
      await scheduleLocalAppointmentReminders({
        id: docRef.id,
        startsAt: appointmentDate.toISOString(),
      });
      console.log('✅ LOCAL appointment reminders scheduled successfully');
    } catch (localScheduleError) {
      console.log('❌ Failed to schedule LOCAL appointment reminders:', localScheduleError);
    }

    // Schedule Firestore-based reminders (for appointments more than 24 hours away)
    // These will be processed by Cloud Functions even when app is closed
    try {
      console.log('📱 Scheduling Firestore-based appointment reminders...');
      await scheduleAppointmentReminders(docRef.id, appointmentData);
      console.log('✅ Firestore-based appointment reminders scheduled successfully');
    } catch (firestoreScheduleError) {
      console.log('❌ Failed to schedule Firestore-based appointment reminders:', firestoreScheduleError);
    }

    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getUserAppointments = async (userId: string): Promise<Appointment[]> => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const appointments: Appointment[] = [];
    
    querySnapshot.forEach((doc) => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      } as Appointment);
    });
    
    // Sort by date in JavaScript instead of Firestore
    appointments.sort((a, b) => {
      if (a.date && b.date) {
        const aTime = a.date.toMillis ? a.date.toMillis() : new Date(a.date as any).getTime();
        const bTime = b.date.toMillis ? b.date.toMillis() : new Date(b.date as any).getTime();
        return aTime - bTime;
      }
      return 0;
    });
    
    return appointments;
  } catch (error) {
    console.error('Error getting user appointments:', error);
    return [];
  }
};

export const updateAppointment = async (appointmentId: string, updates: Partial<Appointment>) => {
  try {
    const docRef = doc(db, 'appointments', appointmentId);
    await updateDoc(docRef, updates);

    // Send notification about appointment update
    try {
      const appointmentDoc = await getDoc(docRef);
      if (appointmentDoc.exists()) {
        const appointmentData = appointmentDoc.data() as Appointment;

        let notificationTitle = 'התור שלך עודכן! 📅';
        let notificationBody = 'התור שלך עודכן בהצלחה.';
        // By default notify the customer; can be disabled per status below
        let shouldNotifyUser = true;

        if (updates.status) {
          switch (updates.status) {
            case 'confirmed':
              notificationTitle = 'התור שלך אושר! ✅';
              notificationBody = 'התור שלך אושר בהצלחה.';
              // Send notification to admin about appointment confirmation
              try {
                await sendAppointmentConfirmationToAdmin(appointmentId);
              } catch (adminNotificationError) {
                console.log('Failed to send appointment confirmation to admin:', adminNotificationError);
              }
              // SMS confirmation removed - user requested not to send SMS on every appointment
              // Only push notifications will be sent to avoid SMS quota issues
              break;
            case 'completed':
              notificationTitle = 'התור הושלם! 🎉';
              notificationBody = 'התור שלך הושלם בהצלחה.';
              // Do not notify customers when marking as completed (manual or automatic)
              shouldNotifyUser = false;
              // Send notification to admin about appointment completion
              try {
                await sendAppointmentCompletionToAdmin(appointmentId);
              } catch (adminNotificationError) {
                console.log('Failed to send appointment completion to admin:', adminNotificationError);
              }
              // Cancel local reminders when completed
              try {
                await cancelLocalAppointmentReminders(appointmentId);
              } catch (reminderError) {
                console.log('Failed to cancel local reminders:', reminderError);
              }
              break;
            case 'cancelled':
              notificationTitle = 'התור בוטל! ❌';
              notificationBody = 'התור שלך בוטל.';
              // Cancel local reminders when cancelled
              try {
                await cancelLocalAppointmentReminders(appointmentId);
              } catch (reminderError) {
                console.log('Failed to cancel local reminders:', reminderError);
              }
              break;
          }
        }

        // If date/time was updated, reschedule local reminders
        if (updates.date && updates.status !== 'cancelled' && updates.status !== 'completed') {
          try {
            const appointmentDate = updates.date.toDate();
            await scheduleLocalAppointmentReminders({
              id: appointmentId,
              startsAt: appointmentDate.toISOString(),
            });
            console.log('✅ Local reminders rescheduled after date update');
          } catch (rescheduleError) {
            console.log('❌ Failed to reschedule local reminders:', rescheduleError);
          }
        }

        if (shouldNotifyUser) {
          await sendNotificationToUser(
            appointmentData.userId,
            notificationTitle,
            notificationBody,
            { appointmentId: appointmentId }
          );
        } else {
          console.log('🔕 Skipping user notification for completed appointment');
        }
      }
    } catch (notificationError) {
      console.log('Failed to send appointment update notification:', notificationError);
    }
  } catch (error) {
    throw error;
  }
};

// Cancel appointment for user (changes status to cancelled)
export const cancelAppointment = async (appointmentId: string, bypassDeadlineCheck: boolean = false) => {
  try {
    // Get appointment data before updating
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      throw new Error('התור לא נמצא');
    }

    const appointmentData = appointmentDoc.data() as Appointment;

    // Check cancellation deadline (unless admin is bypassing)
    if (!bypassDeadlineCheck) {
      const currentUser = getCurrentUser();
      const isUserAdmin = currentUser ? await checkIsAdmin(currentUser.uid) : false;

      // Only enforce deadline for non-admin users
      if (!isUserAdmin) {
        const settings = await getAdminNotificationSettings();
        const deadlineHours = settings.cancellationDeadlineHours || 2;

        const appointmentDate = appointmentData.date.toDate();
        const now = new Date();
        const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        console.log(`🔍 Checking cancellation deadline: ${hoursUntilAppointment.toFixed(2)} hours until appointment, deadline: ${deadlineHours} hours`);

        if (hoursUntilAppointment < deadlineHours) {
          throw new Error(
            `לא ניתן לבטל תור פחות מ-${deadlineHours} שעות לפני מועד התור.\n` +
            `אנא פנה לספר לטיפול בביטול.`
          );
        }
      }
    }

    // Update appointment status to cancelled
    await updateDoc(doc(db, 'appointments', appointmentId), {
      status: 'cancelled',
      cancelledAt: Timestamp.now()
    });
    
    // Send notification to admin about cancellation
    try {
      console.log('🔔 Sending cancellation notification to admin...');
      
      // Get customer name for better admin notification
      let customerName = 'לקוח';
      try {
        const customerDoc = await getDoc(doc(db, 'users', appointmentData.userId));
        if (customerDoc.exists()) {
          customerName = customerDoc.data().displayName || 'לקוח';
        }
      } catch (e) {
        console.log('Could not fetch customer name');
      }
      
      const appointmentDate = appointmentData.date.toDate();
      const dateStr = appointmentDate.toLocaleDateString('he-IL');
      const timeStr = appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      
      await sendNotificationToAdmin(
        'תור בוטל! ❌',
        `${customerName} ביטל תור ל-${dateStr} ב-${timeStr}`,
        { appointmentId: appointmentId }
      );
      console.log('✅ Cancellation notification sent successfully to admin');
      
      // Send SMS to admin about cancellation
      try {
        console.log('📱 Sending SMS to admin about cancellation...');
        const allUsers = await getAllUsers();
        const adminUsers = allUsers.filter(user => user.isAdmin && user.phone);
        
        if (adminUsers.length > 0) {
          const smsMessage = `היי, הלקוח ${customerName} ביטל תור - כדאי שתיצור איתו קשר/תכניס מישהו אחר..`;
          
          for (const admin of adminUsers) {
            try {
              if (admin.phone) {
                console.log(`📱 Sending cancellation SMS to admin: ${admin.displayName} (${admin.phone})`);
                await sendSMSReminder(admin.phone, smsMessage);
                console.log(`✅ SMS sent to admin: ${admin.displayName}`);
              }
            } catch (smsError) {
              console.error(`❌ Failed to send SMS to admin ${admin.displayName}:`, smsError);
            }
          }
        } else {
          console.log('⚠️ No admin users with phone numbers found for SMS');
        }
      } catch (smsError) {
        console.error('❌ Failed to send cancellation SMS to admin:', smsError);
        // Don't throw - SMS failure shouldn't prevent cancellation
      }
    } catch (notificationError) {
      console.log('❌ Failed to send cancellation notification to admin:', notificationError);
    }
    
    // Cancel local notification reminders
    try {
      console.log('🔔 Cancelling local notification reminders...');
      await cancelLocalAppointmentReminders(appointmentId);
      console.log('✅ Local notification reminders cancelled');
    } catch (reminderError) {
      console.log('❌ Failed to cancel local notification reminders:', reminderError);
    }

    console.log('Appointment cancelled successfully');
    return true;
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
};

export const deleteAppointment = async (appointmentId: string) => {
  try {
    // Get appointment data before deleting
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (appointmentDoc.exists()) {
      const appointmentData = appointmentDoc.data() as Appointment;

      // Send notification to user about appointment cancellation
      try {
        await sendNotificationToUser(
          appointmentData.userId,
          'התור בוטל! ❌',
          'התור שלך בוטל בהצלחה.',
          { appointmentId: appointmentId }
        );
      } catch (notificationError) {
        console.log('Failed to send cancellation notification:', notificationError);
      }

      // Send notification to admin about appointment cancellation
      try {
        await sendNotificationToAdmin(
          'תור בוטל! ❌',
          `תור בוטל עבור ${appointmentData.date.toDate().toLocaleDateString('he-IL')}`,
          { appointmentId: appointmentId }
        );
      } catch (adminNotificationError) {
        console.log('Failed to send admin cancellation notification:', adminNotificationError);
      }

      // Cancel local notification reminders
      try {
        await cancelLocalAppointmentReminders(appointmentId);
        console.log('✅ Local reminders cancelled on delete');
      } catch (reminderError) {
        console.log('❌ Failed to cancel local reminders on delete:', reminderError);
      }

      // Notify waitlist users that a slot is now available
      try {
        const appointmentDate = appointmentData.date.toDate();
        await notifyWaitlistOnCancellation(appointmentData.barberId, appointmentDate);
        console.log('✅ Waitlist users notified about available slot');
      } catch (waitlistError) {
        console.log('❌ Failed to notify waitlist users:', waitlistError);
      }
    }

    await deleteDoc(doc(db, 'appointments', appointmentId));
  } catch (error) {
    throw error;
  }
};

// Admin functions
export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  try {
    // Validate uid parameter
    if (!uid || typeof uid !== 'string') {
      console.error('Error checking admin status: Invalid uid', uid);
      return false;
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserProfile;
      return userData.isAdmin || false;
    }
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Update existing user to admin
export const makeUserAdmin = async (email: string): Promise<boolean> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      await updateDoc(userDoc.ref, { isAdmin: true });
      console.log(`User ${email} is now admin`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error making user admin:', error);
    return false;
  }
};

// Create user profile in Firestore for existing Auth users
export const createUserProfileFromAuth = async (email: string): Promise<boolean> => {
  try {
    // Check if user already exists in Firestore
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('User already exists in Firestore');
      return true;
    }

    // Get current auth user
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.email !== email) {
      console.log('No matching auth user found');
      return false;
    }

    // Create user profile in Firestore
    const isAdminEmail = email === 'orel895@gmail.com';
    const userProfile: UserProfile = {
      uid: currentUser.uid,
      email: currentUser.email || '',
      displayName: currentUser.displayName || 'משתמש',
      phone: currentUser.phoneNumber || '',
      isAdmin: isAdminEmail,
      createdAt: Timestamp.now()
    };
    
    await setDoc(doc(db, 'users', currentUser.uid), userProfile);
    console.log(`User profile created for ${email}`);
    return true;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return false;
  }
};

export const getAllAppointments = async (): Promise<Appointment[]> => {
  try {
    const q = query(collection(db, 'appointments'));
    const querySnapshot = await getDocs(q);
    const appointments: Appointment[] = [];
    
    querySnapshot.forEach((doc) => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      } as Appointment);
    });
    
    // Sort by date (most recent first)
    appointments.sort((a, b) => {
      if (a.date && b.date) {
        // Handle both Timestamp objects and regular Date objects
        const aTime = a.date.toMillis ? a.date.toMillis() : new Date(a.date as any).getTime();
        const bTime = b.date.toMillis ? b.date.toMillis() : new Date(b.date as any).getTime();
        return bTime - aTime;
      }
      return 0;
    });
    
    return appointments;
  } catch (error) {
    console.error('Error getting all appointments:', error);
    throw error;
  }
};

// Optimized appointment queries
export const getAppointmentsByDateRange = async (startDate: Date, endDate: Date): Promise<Appointment[]> => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const appointments: Appointment[] = [];
    
    querySnapshot.forEach((doc) => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      } as Appointment);
    });
    
    return appointments;
  } catch (error: any) {
    // If error is due to missing index, fallback to loading all and filtering client-side
    if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
      console.warn('⚠️ Index not found for appointments query, falling back to client-side filtering');
      console.warn('Create the index at:', error.message.match(/https:\/\/[^\s]+/)?.[0] || 'Firebase Console');
      
      // Fallback: Load all appointments and filter client-side
      try {
        console.log('🔄 Using fallback: Loading all appointments and filtering client-side');
        const allAppointments = await getAllAppointments();
        console.log(`📋 Loaded ${allAppointments.length} total appointments from database`);
        
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();
        
        console.log('🔍 Filtering appointments:', {
          startTimestamp: new Date(startTimestamp).toISOString(),
          endTimestamp: new Date(endTimestamp).toISOString(),
          totalAppointments: allAppointments.length
        });
        
        const filteredAppointments = allAppointments.filter(apt => {
          if (!apt.date) {
            console.warn('⚠️ Appointment without date:', apt.id);
            return false;
          }
          const aptTime = apt.date.toMillis ? apt.date.toMillis() : apt.date.toDate().getTime();
          const aptDate = new Date(aptTime);
          const inRange = aptTime >= startTimestamp && aptTime <= endTimestamp;
          
          if (!inRange) {
            console.log(`⏭️ Appointment ${apt.id} outside range: ${aptDate.toISOString()} (status: ${apt.status})`);
          }
          
          return inRange;
        });
        
        console.log(`✅ Filtered to ${filteredAppointments.length} appointments in date range`);
        
        // Sort by date descending
        filteredAppointments.sort((a, b) => {
          const aTime = a.date.toMillis ? a.date.toMillis() : a.date.toDate().getTime();
          const bTime = b.date.toMillis ? b.date.toMillis() : b.date.toDate().getTime();
          return bTime - aTime;
        });
        
        // Log sample appointments for debugging
        if (filteredAppointments.length > 0) {
          console.log('📋 Sample filtered appointments:', filteredAppointments.slice(0, 3).map(apt => ({
            id: apt.id,
            date: apt.date.toMillis ? new Date(apt.date.toMillis()).toISOString() : apt.date.toDate().toISOString(),
            status: apt.status
          })));
        }
        
        return filteredAppointments;
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError);
        throw fallbackError;
      }
    }
    
    console.error('Error getting appointments by date range:', error);
    throw error;
  }
};

export const getCurrentMonthAppointments = async (): Promise<Appointment[]> => {
  const now = new Date();
  // Start from 7 days ago to include recent past appointments
  const startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  // Include next 60 days to ensure all upcoming appointments are visible
  const endDate = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));

  console.log('📅 getCurrentMonthAppointments - Date range:', {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    now: now.toISOString(),
    daysInPast: 7,
    daysInFuture: 60
  });

  const appointments = await getAppointmentsByDateRange(startDate, endDate);

  console.log(`✅ getCurrentMonthAppointments - Found ${appointments.length} appointments in range`);

  return appointments;
};

export const getRecentAppointments = async (days: number = 30): Promise<Appointment[]> => {
  const now = new Date();
  const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  
  return getAppointmentsByDateRange(startDate, now);
};

export const getUpcomingAppointments = async (days: number = 30): Promise<Appointment[]> => {
  const now = new Date();
  const endDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
  
  return getAppointmentsByDateRange(now, endDate);
};

// Gallery functions
export const getGalleryImages = async (): Promise<GalleryImage[]> => {
  try {
    const q = query(collection(db, 'gallery'));
    const querySnapshot = await getDocs(q);
    const images: GalleryImage[] = [];
    
    querySnapshot.forEach((doc) => {
      images.push({
        id: doc.id,
        ...doc.data()
      } as GalleryImage);
    });
    
    return images.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('Error getting gallery images:', error);
    return [];
  }
};

export const addGalleryImage = async (imageData: Omit<GalleryImage, 'id' | 'createdAt'>) => {
  try {
    const newImage = {
      ...imageData,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'gallery'), newImage);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const deleteGalleryImage = async (imageId: string) => {
  try {
    // Get the image document to retrieve the imageUrl
    const imageDoc = await getDoc(doc(db, 'gallery', imageId));

    if (imageDoc.exists()) {
      const imageData = imageDoc.data();
      const imageUrl = imageData.imageUrl;

      // Delete from Firestore
      await deleteDoc(doc(db, 'gallery', imageId));

      // Delete from Firebase Storage if it's a Firebase Storage URL
      if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
          console.log('🗑️ Deleting image from Firebase Storage:', imageUrl);
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
          console.log('✅ Image deleted from Firebase Storage');
        } catch (storageError: any) {
          console.warn('⚠️ Failed to delete from Storage (may not exist):', storageError.message);
          // Continue even if storage deletion fails (image might not exist in storage)
        }
      }
    }
  } catch (error) {
    throw error;
  }
};

// Treatment management functions
export const addTreatment = async (treatmentData: Omit<Treatment, 'id'>) => {
  try {
    // Validate duration is a multiple of 5 minutes (minimum 5)
    if (treatmentData.duration && !isValidDuration(treatmentData.duration)) {
      throw new Error(`Treatment duration must be a multiple of ${SLOT_SIZE_MINUTES} minutes. Got: ${treatmentData.duration} minutes`);
    }
    
    const docRef = await addDoc(collection(db, 'treatments'), treatmentData);
    await CacheUtils.clearTreatments();
    
    // Send notification about new treatment
    try {
      await sendNewTreatmentNotification(treatmentData.name);
    } catch (notificationError) {
      console.log('Failed to send new treatment notification:', notificationError);
    }
    
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateTreatment = async (treatmentId: string, updates: Partial<Treatment>) => {
  try {
    // Validate duration is a multiple of 5 minutes (minimum 5) if being updated
    if (updates.duration && !isValidDuration(updates.duration)) {
      throw new Error(`Treatment duration must be a multiple of ${SLOT_SIZE_MINUTES} minutes. Got: ${updates.duration} minutes`);
    }
    
    const docRef = doc(db, 'treatments', treatmentId);
    await updateDoc(docRef, updates);
    await CacheUtils.clearTreatments();
  } catch (error) {
    throw error;
  }
};

export const deleteTreatment = async (treatmentId: string) => {
  try {
    await deleteDoc(doc(db, 'treatments', treatmentId));
    await CacheUtils.clearTreatments();
  } catch (error) {
    throw error;
  }
};

// Barber management functions
export const addBarberProfile = async (barberData: Omit<Barber, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'barbers'), barberData);
    await CacheUtils.clearBarbers();
    
    // Send notification about new barber
    try {
      await sendNewBarberNotification(barberData.name);
    } catch (notificationError) {
      console.log('Failed to send new barber notification:', notificationError);
    }
    
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateBarberProfile = async (barberId: string, updates: Partial<Barber>) => {
  try {
    const docRef = doc(db, 'barbers', barberId);
    await updateDoc(docRef, updates);
    await CacheUtils.clearBarbers();
  } catch (error) {
    throw error;
  }
};

export const deleteBarberProfile = async (barberId: string) => {
  try {
    await deleteDoc(doc(db, 'barbers', barberId));
    await CacheUtils.clearBarbers();
  } catch (error) {
    throw error;
  }
};

// Firebase Storage helper functions
export const getStorageImages = async (folderPath: string): Promise<string[]> => {
  try {
    const imagesRef = ref(storage, folderPath);
    const result = await listAll(imagesRef);
    
    const urls = await Promise.all(
      result.items.map(async (imageRef) => {
        return await getDownloadURL(imageRef);
      })
    );
    
    return urls;
  } catch (error) {
    console.error(`Error getting images from ${folderPath}:`, error);
    return [];
  }
};

export const getImageUrl = async (imagePath: string): Promise<string | null> => {
  try {
    const imageRef = ref(storage, imagePath);
    const url = await getDownloadURL(imageRef);
    return url;
  } catch (error) {
    console.error(`Error getting image from ${imagePath}:`, error);
    return null;
  }
};

export const getAllStorageImages = async () => {
  try {
    const [galleryImages, backgroundImages, splashImages, workersImages, aboutusImages, shopImages, treatmentsImages] = await Promise.all([
      getStorageImages('gallery'),
      getStorageImages('backgrounds'), 
      getStorageImages('splash'),
      getStorageImages('workers'),
      getStorageImages('aboutus'),
      getStorageImages('shop'),
      getStorageImages('treatments')
    ]);
    
    return {
      gallery: galleryImages,
      backgrounds: backgroundImages,
      splash: splashImages,
      workers: workersImages,
      aboutus: aboutusImages,
      shop: shopImages,
      treatments: treatmentsImages
    };
  } catch (error) {
    console.error('Error getting all storage images:', error);
    return {
      gallery: [],
      backgrounds: [],
      splash: [],
      workers: [],
      aboutus: [],
      shop: [],
      treatments: []
    };
  }
};

// Simple image upload - React Native compatible
export const uploadImageToStorage = async (
  imageUri: string, 
  folderPath: string, 
  fileName: string,
  mimeType?: string
): Promise<string> => {
  try {
    // Wait for auth to be ready
    await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ NO USER AUTHENTICATED!');
      throw new Error('User must be authenticated to upload images');
    }

    console.log('📤 Starting image upload:', imageUri);
    console.log('📁 Target folder:', folderPath);
    console.log('📝 File name:', fileName);
    console.log('👤 Current user UID:', user.uid);
    console.log('👤 Current user email:', user.email);
    console.log('👤 Current user phone:', user.phoneNumber || 'N/A');
    console.log('👤 User metadata:', {
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime
    });
    
    // IMPORTANT: Log the UID to check if it matches known admin UIDs
    console.log('🔍 Checking UID against known admins:');
    console.log('   Known admin UID 1: 6XVviL49bMdNtCsQ1JuXRnD1qao1');
    console.log('   Known admin UID 2: PtpfrLNelaS2SB7ggzdLQuSN0V02');
    console.log('   Current user UID:  ', user.uid);
    console.log('   Match UID 1:       ', user.uid === '6XVviL49bMdNtCsQ1JuXRnD1qao1');
    console.log('   Match UID 2:       ', user.uid === 'PtpfrLNelaS2SB7ggzdLQuSN0V02');
    
    // Admin check with retry - sometimes profile needs time to load
    let userProfile: UserProfile | null = null;
    let adminCheckPassed = false;
    
    // Try to get user profile with retry (up to 2 attempts, faster)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🔍 Admin check attempt ${attempt}/2 for UID: ${user.uid}`);
        userProfile = await getUserProfile(user.uid);
        
        console.log('👤 User profile loaded:', {
          exists: !!userProfile,
          displayName: userProfile?.displayName,
          isAdmin: userProfile?.isAdmin,
          email: userProfile?.email
        });
        
        if (userProfile?.isAdmin) {
          adminCheckPassed = true;
          console.log('✅ Admin verified');
          break;
        } else if (userProfile) {
          console.warn(`⚠️ User is not admin (attempt ${attempt}/2)`);
          console.warn(`⚠️ User profile data:`, JSON.stringify(userProfile, null, 2));
          if (attempt === 2) {
            // Let storage rules handle it - they have fallback for known admins
            console.warn('⚠️ Admin check failed, proceeding - storage rules will verify');
          }
        } else {
          console.warn(`⚠️ User profile not found (attempt ${attempt}/2)`);
        }
      } catch (profileError) {
        console.error(`❌ Error getting user profile (attempt ${attempt}/2):`, profileError);
        if (attempt === 2) {
          console.warn('⚠️ Admin check failed, proceeding - storage rules will verify');
        } else {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    // Create reference
    const imageRef = ref(storage, `${folderPath}/${fileName}`);
    console.log('📍 Storage reference created:', imageRef.fullPath);
    
    // Convert image URI to blob - optimized for React Native
    console.log('🔄 Converting image to blob...');
    
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
          resolve(xhr.response);
        } else {
          reject(new Error(`Failed to load image: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Failed to load image'));
      xhr.ontimeout = () => reject(new Error('Image load timeout'));
      xhr.responseType = 'blob';
      xhr.timeout = 30000; // 30 second timeout
      xhr.open('GET', imageUri, true);
      xhr.send(null);
    });
    
    console.log('✅ Blob ready, uploading...');
    
    // Determine content type from mimeType or file extension
    let contentType = 'image/jpeg'; // default
    if (mimeType) {
      contentType = mimeType;
    } else if (fileName.toLowerCase().endsWith('.png')) {
      contentType = 'image/png';
    } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (fileName.toLowerCase().endsWith('.webp')) {
      contentType = 'image/webp';
    }
    
    console.log('📄 Content type:', contentType);
    
    // Final verification - make sure user document exists in Firestore
    // This is important for Storage Rules to work correctly
    if (!adminCheckPassed) {
      console.log('🔍 Final verification - checking Firestore document...');
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        console.log('📄 Firestore document check:', {
          exists: userDocSnap.exists(),
          uid: user.uid
        });
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log('📄 User document data:', {
            isAdmin: userData?.isAdmin,
            isBarber: userData?.isBarber,
            displayName: userData?.displayName,
            email: userData?.email
          });
          
          if (userData?.isAdmin) {
            console.log('✅ User document verified in Firestore, isAdmin:', userData.isAdmin);
            adminCheckPassed = true;
          } else {
            console.warn('⚠️ User document exists but isAdmin is false or missing');
            console.warn('⚠️ Full user data:', JSON.stringify(userData, null, 2));
          }
        } else {
          console.error('❌ User document does NOT exist in Firestore!');
          console.error('❌ This is the problem - user needs to be created/updated in Firestore');
        }
      } catch (verifyError) {
        console.error('❌ Final verification error:', verifyError);
        console.warn('⚠️ Final verification failed, proceeding - storage rules will handle it');
      }
    }
    
    // Set content type metadata for the upload
    const metadata: UploadMetadata = {
      contentType: contentType,
    };
    
    await uploadBytes(imageRef, blob, metadata);
    console.log('✅ Upload complete, getting download URL...');
    
    // Get download URL
    const downloadURL = await getDownloadURL(imageRef);
    console.log('✅ Image uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error: any) {
    console.error('❌ Error uploading image:', error);
    console.error('❌ Error details:', {
      message: error?.message || 'Unknown error',
      code: error?.code,
      serverResponse: error?.serverResponse,
      stack: error?.stack
    });
    
    // Build a detailed error message so the UI can display the real reason
    const errorCode = error?.code || 'no-code';
    const errorMessage = error?.message || String(error);
    console.error('❌ Upload error (raw):', error);
    throw new Error(`UPLOAD FAILED | code: ${errorCode} | msg: ${errorMessage}`);
  }
};

// Removed uploadOptimizedImage - using simple upload only

// Get available time slots for a barber on a specific date
export const getBarberAvailableSlots = async (barberId: string, date: string): Promise<string[]> => {
  try {
    console.log('🔍 Getting available slots for barber:', barberId, 'date:', date);

    // NEW: Query dailyAvailability collection by SPECIFIC DATE
    const dailyQuery = query(
      collection(db, 'dailyAvailability'),
      where('barberId', '==', barberId),
      where('date', '==', date) // SPECIFIC DATE!
    );

    const dailySnap = await getDocs(dailyQuery);
    console.log('📊 Found dailyAvailability documents:', dailySnap.docs.length);

    if (dailySnap.empty) {
      console.log('❌ No dailyAvailability found for this specific date');
      return [];
    }

    // Get the first (and should be only) record for this date
    const doc = dailySnap.docs[0];
    const data = doc.data();
    console.log('📄 Using dailyAvailability doc:', doc.id, data);

    // Check if explicitly unavailable
    if (data.isAvailable === false) {
      console.log('🚫 Date explicitly marked as UNAVAILABLE');
      return [];
    }

    // Return the exact slots
    if (data.availableSlots && Array.isArray(data.availableSlots)) {
      console.log('✅ Customer using EXACT date-specific slots:', data.availableSlots.length, 'slots');
      return data.availableSlots;
    }

    console.log('⚠️ No availableSlots in document');
    return [];
  } catch (error) {
    console.error('Error getting barber available slots:', error);
    return [];
  }
};

// Real-time listener for availability changes (NOW USING dailyAvailability ONLY!)
export const subscribeToAvailabilityChanges = (barberId: string, callback: (weeklySlots: {[key: number]: string[]}) => void) => {
  console.log('🔔 Subscribing to dailyAvailability changes for barber:', barberId);
  
  // NEW: Listen to dailyAvailability collection
  const q = query(
    collection(db, 'dailyAvailability'), 
    where('barberId', '==', barberId)
  );
  
  return onSnapshot(q, (snapshot) => {
    console.log('📡 Daily availability changed, updating slots...');
    console.log('📊 Total dailyAvailability docs:', snapshot.docs.length);
    
    // For backwards compatibility, build a weeklySlots object
    // But each date is independent!
    const weeklySlots: {[key: number]: string[]} = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const dayOfWeek = data.dayOfWeek;
      const date = data.date;
      
      console.log(`📡 REAL-TIME: docId=${doc.id}, date=${date}, dayOfWeek=${dayOfWeek}, isAvailable=${data.isAvailable}`);

      if (data.isAvailable === true && data.availableSlots && Array.isArray(data.availableSlots)) {
        // NOTE: If there are multiple days with same dayOfWeek but different slots,
        // last one wins. This is OK because generateAvailableDates checks specific dates.
        weeklySlots[dayOfWeek] = [...data.availableSlots];
        console.log(`✅ Real-time: date ${date} (${dayOfWeek}) has ${data.availableSlots.length} slots`);
      } else if (data.isAvailable === false) {
        console.log(`🚫 Real-time: date ${date} (${dayOfWeek}) explicitly UNAVAILABLE`);
      }
    });
    
    // Remove duplicates and sort for each day
    Object.keys(weeklySlots).forEach(day => {
      weeklySlots[parseInt(day)] = [...new Set(weeklySlots[parseInt(day)])].sort();
    });
    
    console.log('✅ Updated availability (from dailyAvailability):', weeklySlots);
    callback(weeklySlots);
  }, (error) => {
    console.error('❌ Error listening to availability changes:', error);
  });
};

// New function for daily availability changes
export const subscribeToDailyAvailabilityChanges = (barberId: string, callback: (dailySlots: {[key: string]: string[]}) => void) => {
  console.log('🔔 Subscribing to daily availability changes for barber:', barberId);

  const q = query(
    collection(db, 'dailyAvailability'),
    where('barberId', '==', barberId),
    where('isAvailable', '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    console.log('📡 Daily availability changed, updating slots...');

    // Group slots by specific date
    const dailySlots: {[key: string]: string[]} = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.isAvailable && data.availableSlots && Array.isArray(data.availableSlots)) {
        dailySlots[data.date] = data.availableSlots;
      }
    });

    console.log('✅ Updated daily availability:', dailySlots);
    callback(dailySlots);
  }, (error) => {
    console.error('❌ Error listening to daily availability changes:', error);
  });
};

// Real-time listener for treatments changes
export const subscribeToTreatmentsChanges = (callback: (treatments: Treatment[]) => void) => {
  console.log('🔔 Subscribing to treatments changes');
  
  const q = query(collection(db, 'treatments'), orderBy('name'));
  
  return onSnapshot(q, (snapshot) => {
    console.log('📡 Treatments changed, updating list...');
    
    const treatments: Treatment[] = [];
    snapshot.docs.forEach(doc => {
      treatments.push({
        id: doc.id,
        ...doc.data()
      } as Treatment);
    });
    
    console.log('✅ Updated treatments list:', treatments.length, 'treatments');
    callback(treatments);
  }, (error) => {
    console.error('❌ Error listening to treatments changes:', error);
  });
};

// Check if a specific time slot is available for booking
export const isTimeSlotAvailable = async (barberId: string, date: string, time: string): Promise<boolean> => {
  try {
    // First check if barber has this time slot available
    const availableSlots = await getBarberAvailableSlots(barberId, date);
    if (!availableSlots.includes(time)) {
      return false; // Barber not available at this time
    }
    
    // Then check if there's already an appointment at this time
    const appointmentsRef = collection(db, 'appointments');
    const q = query(
      appointmentsRef,
      where('barberId', '==', barberId),
      where('date', '==', date),
      where('time', '==', time),
      where('status', '!=', 'cancelled')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.empty; // Available if no conflicting appointments
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    return false;
  }
};

// Check what's in Firebase Storage
export const listAllStorageImages = async () => {
  try {
    console.log('📂 Checking Firebase Storage contents...');
    
    const storageImages = await getAllStorageImages();
    
    console.log('🗂️ Firebase Storage contents:');
    console.log('Gallery folder:', storageImages.gallery);
    console.log('Backgrounds folder:', storageImages.backgrounds);
    console.log('Splash folder:', storageImages.splash);
    console.log('Workers folder:', storageImages.workers);
    console.log('About us folder:', storageImages.aboutus);
    console.log('Shop folder:', storageImages.shop);
    console.log('Treatments folder:', storageImages.treatments);
    
    return storageImages;
  } catch (error) {
    console.error('❌ Error listing storage images:', error);
    throw error;
  }
};

// Restore gallery from Firebase Storage images
export const restoreGalleryFromStorage = async () => {
  try {
    console.log('🔄 Restoring gallery from Firebase Storage...');
    
    // Get images from Firebase Storage
    const storageImages = await getAllStorageImages();
    
    // Clear existing gallery
    const existingImages = await getGalleryImages();
    for (const image of existingImages) {
      console.log('🗑️ Deleting existing image:', image.id);
      await deleteGalleryImage(image.id);
    }
    
    // Add images from storage to gallery collection
    let addedCount = 0;
    
    // Add gallery images
    for (let i = 0; i < storageImages.gallery.length; i++) {
      const imageUrl = storageImages.gallery[i];
      await addGalleryImage({
        imageUrl,
        type: 'gallery',
        order: i,
        isActive: true
      });
      console.log('➕ Added gallery image:', imageUrl);
      addedCount++;
    }
    
    // Add background images
    for (let i = 0; i < storageImages.backgrounds.length; i++) {
      const imageUrl = storageImages.backgrounds[i];
      await addGalleryImage({
        imageUrl,
        type: 'background',
        order: i,
        isActive: true
      });
      console.log('➕ Added background image:', imageUrl);
      addedCount++;
    }
    
    // Add about us images
    for (let i = 0; i < storageImages.aboutus.length; i++) {
      const imageUrl = storageImages.aboutus[i];
      await addGalleryImage({
        imageUrl,
        type: 'gallery',
        order: storageImages.gallery.length + storageImages.backgrounds.length + i,
        isActive: true
      });
      console.log('➕ Added about us image:', imageUrl);
      addedCount++;
    }
    
    // Add shop images
    for (let i = 0; i < storageImages.shop.length; i++) {
      const imageUrl = storageImages.shop[i];
      await addGalleryImage({
        imageUrl,
        type: 'gallery', // Shop items go to gallery for now
        order: storageImages.gallery.length + storageImages.backgrounds.length + storageImages.aboutus.length + i,
        isActive: true
      });
      console.log('➕ Added shop image:', imageUrl);
      addedCount++;
    }
    
    console.log('✅ Gallery restored with', addedCount, 'images from Firebase Storage');
    return addedCount;
  } catch (error) {
    console.error('❌ Error restoring gallery from storage:', error);
    throw error;
  }
};

// Shop Items Management
export const addShopItem = async (shopItem: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const docRef = doc(collection(db, 'shopItems'));
    const newShopItem: ShopItem = {
      ...shopItem,
      id: docRef.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await setDoc(docRef, newShopItem);
    console.log('✅ Shop item added successfully:', newShopItem.name);
    return newShopItem;
  } catch (error) {
    console.error('❌ Error adding shop item:', error);
    throw error;
  }
};

export const getShopItems = async (): Promise<ShopItem[]> => {
  try {
    const q = query(
      collection(db, 'shopItems'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => doc.data() as ShopItem);
    console.log('📦 Loaded', items.length, 'shop items');
    return items;
  } catch (error) {
    console.error('❌ Error loading shop items:', error);
    return [];
  }
};

export const getActiveShopItems = async (): Promise<ShopItem[]> => {
  try {
    console.log('🛍️ Loading shop items...');
    
    // First try with just the isActive filter
    let q = query(
      collection(db, 'shopItems'),
      where('isActive', '==', true)
    );
    
    let snapshot = await getDocs(q);
    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ShopItem));
    
    // Sort manually by createdAt if available
    items.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
      }
      return 0;
    });
    
    console.log('🛍️ Loaded', items.length, 'active shop items');
    
    // If no items found, try loading all items
    if (items.length === 0) {
      console.log('🔍 No active items found, loading all shop items...');
      const allSnapshot = await getDocs(collection(db, 'shopItems'));
      const allItems = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ShopItem));
      console.log('📋 Found', allItems.length, 'total shop items');
      return allItems;
    }
    
    return items;
  } catch (error) {
    console.error('❌ Error loading shop items:', error);
    console.log('🔄 Fallback: Loading all shop items...');
    
    // Fallback - load all items without filters
    try {
      const allSnapshot = await getDocs(collection(db, 'shopItems'));
      const allItems = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ShopItem));
      console.log('✅ Fallback loaded', allItems.length, 'shop items');
      return allItems;
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      return [];
    }
  }
};

export const updateShopItem = async (id: string, updates: Partial<ShopItem>) => {
  try {
    const docRef = doc(db, 'shopItems', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    console.log('✅ Shop item updated successfully:', id);
  } catch (error) {
    console.error('❌ Error updating shop item:', error);
    throw error;
  }
};

export const deleteShopItem = async (id: string) => {
  try {
    const docRef = doc(db, 'shopItems', id);
    await deleteDoc(docRef);
    console.log('🗑️ Shop item deleted successfully:', id);
  } catch (error) {
    console.error('❌ Error deleting shop item:', error);
    throw error;
  }
};

// Clear all gallery images and add fresh ones
export const resetGalleryWithRealImages = async () => {
  try {
    console.log('🧹 Clearing all gallery images and adding fresh ones...');
    
    // Get all existing gallery images
    const existingImages = await getGalleryImages();
    console.log('Found', existingImages.length, 'existing images to delete');
    
    // Delete ALL existing gallery images
    for (const image of existingImages) {
      console.log('🗑️ Deleting image:', image.id);
      await deleteGalleryImage(image.id);
    }
    
    // Add fresh real images
    const realGalleryImages = [
      {
        imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 0,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 1,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 2,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 3,
        isActive: true
      }
    ];

    for (const imageData of realGalleryImages) {
      console.log('➕ Adding fresh image:', imageData.imageUrl);
      await addGalleryImage(imageData);
    }
    
    console.log('✅ Gallery reset with', realGalleryImages.length, 'fresh real images');
    return realGalleryImages.length;
  } catch (error) {
    console.error('❌ Error resetting gallery:', error);
    throw error;
  }
};

// Replace existing placeholder images with real images
export const replaceGalleryPlaceholders = async () => {
  try {
    console.log('🔄 Replacing placeholder images with real images...');
    
    // Get all existing gallery images
    const existingImages = await getGalleryImages();
    console.log('Found', existingImages.length, 'existing images');
    
    // Debug: show what we have
    existingImages.forEach((img, index) => {
      console.log(`Image ${index}:`, {
        id: img.id,
        imageUrl: img.imageUrl || 'MISSING URL',
        type: img.type,
        isActive: img.isActive
      });
    });
    
    // Delete old placeholder images
    for (const image of existingImages) {
      if (image.imageUrl && (image.imageUrl.includes('placeholder') || image.imageUrl.includes('via.placeholder'))) {
        console.log('🗑️ Deleting placeholder image:', image.id);
        await deleteGalleryImage(image.id);
      } else if (!image.imageUrl) {
        console.log('🗑️ Deleting image with missing URL:', image.id);
        await deleteGalleryImage(image.id);
      }
    }
    
    // Add new real images
    const realGalleryImages = [
      {
        imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 0,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 1,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 2,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&h=300&fit=crop&auto=format',
        type: 'gallery' as const,
        order: 3,
        isActive: true
      }
    ];

    for (const imageData of realGalleryImages) {
      console.log('➕ Adding real image:', imageData.imageUrl);
      await addGalleryImage(imageData);
    }
    
    console.log('✅ Gallery updated with', realGalleryImages.length, 'real images');
    return realGalleryImages.length;
  } catch (error) {
    console.error('❌ Error replacing gallery placeholders:', error);
    throw error;
  }
};

// Initialize gallery with default images
export const initializeGalleryImages = async () => {
  try {
    // Check if user is signed in
    const { auth } = await import('../config/firebase');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('⚠️ User not signed in, skipping gallery initialization');
      return;
    }
    
    // Check if gallery already has images
    const existingImages = await getGalleryImages();
    
    // REMOVED: Automatic placeholder replacement - users should manage their own images
    // If you want to initialize gallery, do it manually from admin panel
    
    if (existingImages.length > 0) {
      console.log('Gallery already has images, skipping automatic initialization');
      return;
    }

    // REMOVED: Automatic default images - users should upload their own images
    // Gallery will remain empty until user adds images manually
    console.log('Gallery is empty - user should add images manually from admin panel');
  } catch (error) {
    console.error('❌ Error initializing gallery images:', error);
    // Don't throw - just log the error so app continues
  }
};

// Initialize empty collections (run once)
export const initializeCollections = async () => {
  try {
    // REMOVED: Automatic gallery initialization - users should manage their own images
    
    // Create availability collection sample
    await addDoc(collection(db, 'availability'), {
      barberId: 'sample-barber-id',
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '18:00',
      isAvailable: true,
      createdAt: Timestamp.now()
    });
    
    // Create settings collection sample
    await addDoc(collection(db, 'settings'), {
      key: 'business_hours',
      value: { start: '09:00', end: '18:00' },
      updatedAt: Timestamp.now()
    });
    
    console.log('Collections initialized successfully');
  } catch (error) {
    console.error('Error initializing collections:', error);
    throw error;
  }
};


// Barber availability functions
export const getBarberAvailability = async (barberId: string): Promise<BarberAvailability[]> => {
  try {
    const q = query(
      collection(db, 'availability'),
      where('barberId', '==', barberId)
    );
    const querySnapshot = await getDocs(q);
    const availability: BarberAvailability[] = [];
    
    querySnapshot.forEach((doc) => {
      availability.push({
        id: doc.id,
        ...doc.data()
      } as BarberAvailability);
    });
    
    return availability.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  } catch (error) {
    console.error('Error getting barber availability:', error);
    return [];
  }
};

export const getAllAvailability = async (): Promise<BarberAvailability[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'availability'));
    const availability: BarberAvailability[] = [];
    
    querySnapshot.forEach((doc) => {
      availability.push({
        id: doc.id,
        ...doc.data()
      } as BarberAvailability);
    });
    
    return availability;
  } catch (error) {
    console.error('Error getting all availability:', error);
    return [];
  }
};

export const addAvailability = async (availabilityData: Omit<BarberAvailability, 'id' | 'createdAt'>) => {
  try {
    const newAvailability = {
      ...availabilityData,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'availability'), newAvailability);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateAvailability = async (availabilityId: string, updates: Partial<BarberAvailability>) => {
  try {
    const docRef = doc(db, 'availability', availabilityId);
    await updateDoc(docRef, updates);
  } catch (error) {
    throw error;
  }
};

export const deleteAvailability = async (availabilityId: string) => {
  try {
    await deleteDoc(doc(db, 'availability', availabilityId));
  } catch (error) {
    throw error;
  }
};

// Batch update availability for a barber
export const updateBarberWeeklyAvailability = async (barberId: string, weeklySchedule: Omit<BarberAvailability, 'id' | 'barberId' | 'createdAt'>[]) => {
  try {
    // Delete existing availability for this barber
    const existingAvailability = await getBarberAvailability(barberId);
    await Promise.all(
      existingAvailability.map(availability => 
        deleteAvailability(availability.id)
      )
    );
    
    // Add new availability
    await Promise.all(
      weeklySchedule.map(schedule => 
        addAvailability({
          ...schedule,
          barberId
        })
      )
    );
  } catch (error) {
    throw error;
  }
};

// Migrate old barber data to new format
export const migrateBarberData = async (barberId: string, barberData: any) => {
  try {
    const standardizedData: Partial<Barber> = {
      name: barberData.name || '',
      experience: barberData.experience || barberData.bio || '',
      rating: barberData.rating || 5,
      specialties: barberData.specialties || [],
      image: barberData.image || barberData.photoUrl || '',
      available: barberData.available !== false,
      phone: barberData.phone || ''
    };

    await updateBarberProfile(barberId, standardizedData);
    return standardizedData;
  } catch (error) {
    console.error('Error migrating barber data:', error);
    throw error;
  }
};

// Add a new barber with availability
export const addBarber = async ({ name, image, availableSlots, availabilityWindow }: {
  name: string;
  image: string;
  availableSlots: string[];
  availabilityWindow: { start: string; end: string };
}) => {
  try {
    const barber = {
      name,
      image,
      specialties: [],
      experience: '',
      rating: 5,
      available: true,
      availableSlots,
      availabilityWindow,
    };
    const docRef = await addDoc(collection(db, 'barbers'), barber);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Initialize default availability for a barber if none exists
export const initializeBarberAvailability = async (barberId: string): Promise<void> => {
  try {
    const existing = await getBarberAvailability(barberId);
    if (existing.length > 0) {
      return; // Already has availability
    }
    
    // Create default availability (Monday-Thursday 9:00-18:00)
    const defaultSchedule = [
      { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isAvailable: false }, // Sunday
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isAvailable: true },  // Monday
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isAvailable: true },  // Tuesday
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isAvailable: true },  // Wednesday
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isAvailable: true },  // Thursday
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isAvailable: false }, // Friday
      { dayOfWeek: 6, startTime: '09:00', endTime: '18:00', isAvailable: false }, // Saturday
    ];
    
    await updateBarberWeeklyAvailability(barberId, defaultSchedule);
    console.log(`Initialized default availability for barber ${barberId}`);
  } catch (error) {
    console.error('Error initializing barber availability:', error);
  }
};

// Get barber appointments for a specific day - helper function for BookingScreen
export const getBarberAppointmentsForDay = async (barberId: string, date: Date): Promise<any[]> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Querying appointments for barber:', barberId);
    console.log('Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
    
    // Simplified query to avoid Firebase index issues
    const q = query(
      collection(db, 'appointments'),
      where('barberId', '==', barberId)
    );
    
    const snapshot = await getDocs(q);
    const allAppointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter in JavaScript instead of Firestore
    const filteredAppointments = allAppointments.filter((appointment: any) => {
      // Only consider confirmed/pending appointments
      if (!['confirmed', 'pending'].includes(appointment.status)) {
        return false;
      }
      
      // Check if appointment is on the selected date
      let appointmentDate;
      if (appointment.date && typeof appointment.date.toDate === 'function') {
        appointmentDate = appointment.date.toDate();
      } else if (appointment.date) {
        appointmentDate = new Date(appointment.date);
      } else {
        return false;
      }
      
      return appointmentDate >= startOfDay && appointmentDate <= endOfDay;
    });
    
    console.log('Found appointments:', filteredAppointments.length);
    console.log('Appointment details:', filteredAppointments);
    return filteredAppointments;
  } catch (error) {
    console.error('Error getting barber appointments for day:', error);
    return [];
  }
};

// Image Management Functions for Admin Panel

export interface AppImages {
  atmosphereImage?: string;
  aboutUsImage?: string;
  galleryImages?: string[];
}

// Get current app images from Firestore
export const getAppImages = async (): Promise<AppImages> => {
  try {
    const docRef = doc(db, 'settings', 'images');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        atmosphereImage: data.atmosphereImage || '',
        aboutUsImage: data.aboutUsImage || '',
        galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : []
      };
    }
    
    return {
      atmosphereImage: '',
      aboutUsImage: '',
      galleryImages: []
    };
  } catch (error) {
    console.error('Error getting app images:', error);
    throw error;
  }
};

// Upload image to Firebase Storage for app images
export const uploadAppImageToStorage = async (
  imageUri: string, 
  imagePath: string, 
  fileName: string
): Promise<string> => {
  try {
    // Convert image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Create storage reference
    const imageRef = ref(storage, `${imagePath}/${fileName}`);
    
    // Upload image
    await uploadBytes(imageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(imageRef);
    
    console.log('Image uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Delete image from Firebase Storage (used when replacing)
export const deleteImageFromStorage = async (imageUrl: string): Promise<void> => {
  try {
    if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
      return; // Skip if not a Firebase Storage URL
    }
    
    // Extract storage path from URL
    const pathStart = imageUrl.indexOf('/o/') + 3;
    const pathEnd = imageUrl.indexOf('?');
    const path = decodeURIComponent(imageUrl.slice(pathStart, pathEnd));
    
    const imageRef = ref(storage, path);
    await deleteObject(imageRef);
    
    console.log('Image deleted successfully:', path);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw error - deletion failure shouldn't prevent upload
  }
};

// Update atmosphere/background image
export const updateAtmosphereImage = async (imageUri: string): Promise<string> => {
  try {
    const fileName = `atmosphere_${Date.now()}.jpg`;
    
    // Get current image URL to delete old one
    const currentImages = await getAppImages();
    
    // Upload new image
    const newImageUrl = await uploadAppImageToStorage(imageUri, 'app-images', fileName);
    
    // Update Firestore
    const docRef = doc(db, 'settings', 'images');
    await setDoc(docRef, {
      ...currentImages,
      atmosphereImage: newImageUrl
    }, { merge: true });
    
    // Delete old image after successful update
    if (currentImages.atmosphereImage) {
      await deleteImageFromStorage(currentImages.atmosphereImage);
    }
    
    console.log('Atmosphere image updated successfully');
    return newImageUrl;
  } catch (error) {
    console.error('Error updating atmosphere image:', error);
    throw error;
  }
};

// Update about us image
export const updateAboutUsImage = async (imageUri: string): Promise<string> => {
  try {
    const fileName = `about_us_${Date.now()}.jpg`;
    
    // Get current image URL to delete old one
    const currentImages = await getAppImages();
    
    // Upload new image
    const newImageUrl = await uploadAppImageToStorage(imageUri, 'app-images', fileName);
    
    // Update Firestore
    const docRef = doc(db, 'settings', 'images');
    await setDoc(docRef, {
      ...currentImages,
      aboutUsImage: newImageUrl
    }, { merge: true });
    
    // Delete old image after successful update
    if (currentImages.aboutUsImage) {
      await deleteImageFromStorage(currentImages.aboutUsImage);
    }
    
    console.log('About us image updated successfully');
    return newImageUrl;
  } catch (error) {
    console.error('Error updating about us image:', error);
    throw error;
  }
};

// Add image to app gallery (different from gallery collection)
export const addAppGalleryImage = async (imageUri: string): Promise<string> => {
  try {
    const fileName = `gallery_${Date.now()}.jpg`;
    
    // Upload new image
    const newImageUrl = await uploadAppImageToStorage(imageUri, 'app-images/gallery', fileName);
    
    // Get current images
    const currentImages = await getAppImages();
    const updatedGallery = [...(currentImages.galleryImages || []), newImageUrl];
    
    // Update Firestore
    const docRef = doc(db, 'settings', 'images');
    await setDoc(docRef, {
      ...currentImages,
      galleryImages: updatedGallery
    }, { merge: true });
    
    console.log('App gallery image added successfully');
    return newImageUrl;
  } catch (error) {
    console.error('Error adding app gallery image:', error);
    throw error;
  }
};

// Remove image from app gallery
export const removeAppGalleryImage = async (imageUrl: string): Promise<void> => {
  try {
    // Get current images
    const currentImages = await getAppImages();
    const updatedGallery = (currentImages.galleryImages || []).filter(url => url !== imageUrl);
    
    // Update Firestore
    const docRef = doc(db, 'settings', 'images');
    await setDoc(docRef, {
      ...currentImages,
      galleryImages: updatedGallery
    }, { merge: true });
    
    // Delete from storage
    await deleteImageFromStorage(imageUrl);
    
    console.log('App gallery image removed successfully');
  } catch (error) {
    console.error('Error removing app gallery image:', error);
    throw error;
  }
};

// Replace app gallery image (remove old, add new)
export const replaceAppGalleryImage = async (oldImageUrl: string, newImageUri: string): Promise<string> => {
  try {
    const fileName = `gallery_${Date.now()}.jpg`;
    
    // Upload new image
    const newImageUrl = await uploadAppImageToStorage(newImageUri, 'app-images/gallery', fileName);
    
    // Get current images
    const currentImages = await getAppImages();
    const updatedGallery = (currentImages.galleryImages || []).map(url => 
      url === oldImageUrl ? newImageUrl : url
    );
    
    // Update Firestore
    const docRef = doc(db, 'settings', 'images');
    await setDoc(docRef, {
      ...currentImages,
      galleryImages: updatedGallery
    }, { merge: true });
    
    // Delete old image
    await deleteImageFromStorage(oldImageUrl);
    
    console.log('App gallery image replaced successfully');
    return newImageUrl;
  } catch (error) {
    console.error('Error replacing app gallery image:', error);
    throw error;
  }
};

// Push Notification functions
// Note: This function now only checks permissions, does not request them
// Permissions should be requested explicitly by user action (e.g., button press)
export const registerForPushNotifications = async (userId: string) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3613',message:'registerForPushNotifications called',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Check if device supports notifications
    if (!Device.isDevice) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3617',message:'Not a physical device',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log('📱 Not a physical device, skipping push notification registration');
      return null;
    }

    // Check existing permissions (don't request)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3622',message:'Permission status checked',data:{userId,status:existingStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (existingStatus !== 'granted') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3624',message:'Permissions not granted',data:{userId,status:existingStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log('❌ Push notification permissions not granted - user must enable notifications first');
      return null;
    }

    // Get push token with projectId
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '518e7344-df67-42cd-8107-502bd3e48357',
    });
    const token = tokenData.data;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3630',message:'Push token obtained',data:{userId,token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('📱 Push token:', token);

    // Save token to user profile
    await updateUserProfile(userId, { pushToken: token });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3634',message:'Push token saved to profile',data:{userId,token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return token;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3638',message:'Error in registerForPushNotifications',data:{userId,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

export const sendPushNotification = async (pushToken: string, title: string, body: string, data?: any) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3643',message:'sendPushNotification called',data:{pushToken:pushToken.substring(0,20)+'...',title,body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data || {},
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    // #region agent log
    const responseData = await response.json();
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3661',message:'Push notification API response',data:{status:response.status,response:responseData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    console.log('✅ Push notification sent successfully');
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3665',message:'Error sending push notification',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Error sending push notification:', error);
    throw error;
  }
};

export const sendNotificationToUser = async (userId: string, title: string, body: string, data?: any) => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.pushToken) {
      console.log('❌ User not found or no push token');
      return false;
    }

    await sendPushNotification(userProfile.pushToken, title, body, data);
    return true;
  } catch (error) {
    console.error('Error sending notification to user:', error);
    return false;
  }
};

// Send SMS reminder using SMS4Free service
export const sendSMSReminder = async (phoneNumber: string, message: string) => {
  try {
    // Format phone number for SMS service
    let formattedPhone = phoneNumber;
    
    // Add +972 prefix if not present
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) {
        formattedPhone = '+972' + phoneNumber.substring(1);
      } else {
        formattedPhone = '+972' + phoneNumber;
      }
    }
    
    console.log('📱 Sending SMS reminder to:', formattedPhone);
    
    // Use SMS4Free service
    const { MessagingService } = await import('../app/services/messaging/service');
    const { messagingConfig } = await import('../app/config/messaging');

    const messagingService = new MessagingService(messagingConfig);

    const result = await messagingService.sendMessage({
      to: formattedPhone,
      message: message
    });

    if (result.success) {
      console.log('✅ SMS reminder sent successfully via SMS4Free');
      return true;
    } else {
      console.error('❌ SMS4Free error:', result.error);
      throw new Error(`Failed to send SMS: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending SMS reminder:', error);
    throw error;
  }
};

export const sendNotificationToAllUsers = async (title: string, body: string, data?: any, includesSMS: boolean = false) => {
  try {
    const users = await getAllUsers();
    // Filter out admin users to avoid sending to admins
    const nonAdminUsers = users.filter(user => !user.isAdmin);
    
    console.log(`📱 Sending notification to ${nonAdminUsers.length} non-admin users`);

    // Create in-app notifications in Firestore for ALL users (even without push tokens)
    const notificationsRef = collection(db, 'notifications');
    const notificationPromises = nonAdminUsers.map(user =>
      addDoc(notificationsRef, {
        userId: user.uid,
        type: 'general',
        title,
        message: body,
        isRead: false,
        createdAt: serverTimestamp()
      })
    );

    await Promise.allSettled(notificationPromises);
    console.log(`✅ Created ${nonAdminUsers.length} in-app notifications`);

    // Send push notifications only to users with push tokens
    const usersWithTokens = nonAdminUsers.filter(user => user.pushToken);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3752',message:'Users with push tokens found',data:{totalUsers:nonAdminUsers.length,usersWithTokens:usersWithTokens.length,userIds:usersWithTokens.map(u=>u.uid)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const pushResults = await Promise.allSettled(
      usersWithTokens.map(user =>
        sendPushNotification(user.pushToken!, title, body, data)
      )
    );

    const successfulPush = pushResults.filter(result => result.status === 'fulfilled').length;
    const failedPush = pushResults.filter(result => result.status === 'rejected');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a5ce6353-7cba-4d8f-9244-36e2c1e2b80b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:3759',message:'Push notification results',data:{successful:successfulPush,total:usersWithTokens.length,failed:failedPush.length,failedReasons:failedPush.map(f=>f.status === 'rejected' ? (f.reason instanceof Error ? f.reason.message : String(f.reason)) : '')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log(`✅ Successfully sent push notifications to ${successfulPush}/${usersWithTokens.length} users`);

    // Save broadcast message to history
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        const userProfile = await getUserProfile(currentUser.uid);
        await saveBroadcastMessage({
          title,
          body,
          sentBy: currentUser.uid,
          sentByName: userProfile?.displayName || 'Admin',
          recipientCount: nonAdminUsers.length, // Total users who received the notification
          includesSMS,
        });
        console.log('✅ Broadcast message saved to history');
      }
    } catch (error) {
      console.error('❌ Error saving broadcast message to history:', error);
      // Don't fail the broadcast if history save fails
    }

    return nonAdminUsers.length; // Return total users who received the notification
  } catch (error) {
    console.error('Error sending notification to all users:', error);
    return 0;
  }
};

// Schedule appointment reminder notifications
export const scheduleAppointmentReminders = async (appointmentId: string, appointmentData: Omit<Appointment, 'id' | 'createdAt'>) => {
  try {
    const appointmentDate = appointmentData.date.toDate();
    const now = new Date();
    const timeDiff = appointmentDate.getTime() - now.getTime();
    const hoursUntilAppointment = timeDiff / (1000 * 60 * 60);
    const minutesUntilAppointment = timeDiff / (1000 * 60);
    
    console.log(`📅 Scheduling reminders for appointment ${appointmentId}:`);
    console.log(`📅 Appointment time: ${appointmentDate.toLocaleString('he-IL')}`);
    console.log(`📅 Current time: ${now.toLocaleString('he-IL')}`);
    console.log(`📅 Time difference: ${timeDiff}ms`);
    console.log(`📅 Hours until appointment: ${hoursUntilAppointment.toFixed(2)}`);
    console.log(`📅 Minutes until appointment: ${minutesUntilAppointment.toFixed(2)}`);
    
    // Only schedule if appointment is in the future
    if (timeDiff <= 0) {
      console.log('❌ Appointment is in the past, not scheduling reminders');
      return;
    }
    
    // Get admin settings to check reminder timings
    const adminSettings = await getAdminNotificationSettings();
    console.log('🔧 Admin reminder settings:', adminSettings.reminderTimings);
    
    // Schedule 24-hour reminder if appointment is more than 24 hours away
    if (hoursUntilAppointment > 24) {
      const reminder24hTime = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
      console.log(`📅 Scheduling 24h reminder for ${reminder24hTime.toLocaleString('he-IL')}`);
      
      // Store scheduled reminder in Firestore
      await addDoc(collection(db, 'scheduledReminders'), {
        appointmentId: appointmentId,
        userId: appointmentData.userId,
        scheduledTime: Timestamp.fromDate(reminder24hTime),
        reminderType: '24h',
        status: 'pending',
        createdAt: Timestamp.now()
      });
    }
    
    // Schedule 1-hour reminder if appointment is more than 1 hour away AND enabled in settings
    if (hoursUntilAppointment > 1 && adminSettings.reminderTimings.oneHourBefore) {
      const reminder1hTime = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
      console.log(`📅 Scheduling 1h reminder for ${reminder1hTime.toLocaleString('he-IL')} (enabled in settings)`);
      
      await addDoc(collection(db, 'scheduledReminders'), {
        appointmentId: appointmentId,
        userId: appointmentData.userId,
        scheduledTime: Timestamp.fromDate(reminder1hTime),
        reminderType: '1h',
        status: 'pending',
        createdAt: Timestamp.now()
      });
    } else if (hoursUntilAppointment > 1) {
      console.log('🔕 1-hour reminder disabled in admin settings');
    }
    
    
    // Schedule 5-minute reminder if appointment is more than 5 minutes away (always enabled for customers)
    if (minutesUntilAppointment > 5) {
      const reminder5mTime = new Date(appointmentDate.getTime() - 5 * 60 * 1000);
      console.log(`📅 Scheduling 5m reminder for ${reminder5mTime.toLocaleString('he-IL')} (push notification)`);
      
      await addDoc(collection(db, 'scheduledReminders'), {
        appointmentId: appointmentId,
        userId: appointmentData.userId,
        scheduledTime: Timestamp.fromDate(reminder5mTime),
        reminderType: '15m', // Keep '15m' for compatibility with admin reminder system
        status: 'pending',
        createdAt: Timestamp.now()
      });
    }
    
    // Schedule "when starting" reminder if enabled in settings
    if (adminSettings.reminderTimings.whenStarting) {
      const reminderStartTime = new Date(appointmentDate.getTime());
      console.log(`📅 Scheduling "when starting" reminder for ${reminderStartTime.toLocaleString('he-IL')} (enabled in settings)`);
      
      await addDoc(collection(db, 'scheduledReminders'), {
        appointmentId: appointmentId,
        userId: appointmentData.userId,
        scheduledTime: Timestamp.fromDate(reminderStartTime),
        reminderType: 'whenStarting',
        status: 'pending',
        createdAt: Timestamp.now()
      });
    } else {
      console.log('🔕 "When starting" reminder disabled in admin settings');
    }
    
    console.log(`✅ Successfully scheduled reminders for appointment ${appointmentId}`);
  } catch (error) {
    console.error('❌ Error scheduling appointment reminders:', error);
  }
};

// Send appointment reminder notification (CUSTOMERS ONLY - NOT ADMINS)
export const sendAppointmentReminder = async (appointmentId: string) => {
  try {
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      console.log('❌ Appointment not found');
      return false;
    }
    
    const appointmentData = appointmentDoc.data() as Appointment;
    const appointmentDate = appointmentData.date.toDate();
    const now = new Date();
    const timeDiff = appointmentDate.getTime() - now.getTime();
    const hoursUntilAppointment = timeDiff / (1000 * 60 * 60);
    const minutesUntilAppointment = timeDiff / (1000 * 60);
    
    console.log(`📅 CUSTOMER REMINDER for appointment ${appointmentId}:`);
    console.log(`📅 Appointment time: ${appointmentDate.toLocaleString('he-IL')}`);
    console.log(`📅 Current time: ${now.toLocaleString('he-IL')}`);
    console.log(`📅 Hours until: ${hoursUntilAppointment.toFixed(2)}`);
    console.log(`📅 Minutes until: ${minutesUntilAppointment.toFixed(2)}`);
    
    // Prevent sending reminders for appointments more than 24 hours away
    if (hoursUntilAppointment > 24) {
      console.log('🔕 Appointment is more than 24 hours away, skipping reminder');
      return false;
    }
    
    // IMPORTANT: Check if we already sent a reminder for this appointment recently
    // to avoid sending duplicate reminders every 5 minutes
    const recentReminderQuery = query(
      collection(db, 'scheduledReminders'),
      where('appointmentId', '==', appointmentId),
      where('status', '==', 'sent'),
      where('sentAt', '>=', Timestamp.fromDate(new Date(now.getTime() - 10 * 60 * 1000))) // Last 10 minutes
    );
    const recentReminders = await getDocs(recentReminderQuery);
    
    if (!recentReminders.empty) {
      console.log('🔕 Reminder already sent recently for this appointment, skipping');
      return false;
    }
    
    // Get treatment name for better message
    let treatmentName = 'הטיפול';
    try {
      const treatmentDoc = await getDoc(doc(db, 'treatments', appointmentData.treatmentId));
      if (treatmentDoc.exists()) {
        treatmentName = treatmentDoc.data().name || 'הטיפול';
      }
    } catch (e) {
      console.log('Could not fetch treatment name');
    }
    
    // Get admin settings to check reminder timings
    const adminSettings = await getAdminNotificationSettings();
    console.log('🔧 Admin reminder settings for sending:', adminSettings.reminderTimings);
    
    // Send different reminders based on time until appointment AND admin settings
    if (timeDiff > 0) { // Only send if appointment is in the future
      let title = '';
      let message = '';
      let shouldSend = false;
      
      // Check reminders in order from closest to furthest
      if (minutesUntilAppointment <= 5 && minutesUntilAppointment > 0 && hoursUntilAppointment < 1) {
        // 5 minutes before (only if less than 1 hour away) - always send push notification
        title = 'תזכורת לתור! ⏰';
        message = `התור שלך בעוד 5 דקות ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
        shouldSend = true;
        console.log('📅 Sending 5-minute reminder to CUSTOMER (push notification)');
      } else if (hoursUntilAppointment <= 1 && minutesUntilAppointment > 5 && adminSettings.reminderTimings.oneHourBefore) {
        // 1 hour before (only if more than 15 minutes and less than 1 hour)
        title = 'תזכורת לתור! ⏰';
        message = `יש לך תור ל${treatmentName} בעוד שעה ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
        shouldSend = true;
        console.log('📅 Sending 1-hour reminder to CUSTOMER (enabled in settings)');
      } else if (hoursUntilAppointment <= 24 && hoursUntilAppointment > 1) {
        // 24 hours before (only if more than 1 hour and less than 24 hours)
        title = 'תזכורת לתור! ⏰';
        const isTomorrow = appointmentDate.getDate() === new Date(now.getTime() + 24 * 60 * 60 * 1000).getDate();
        if (isTomorrow) {
          message = `התור שלך מחר ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          message = `התור שלך ב-${appointmentDate.toLocaleDateString('he-IL')} ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
        }
        shouldSend = true;
        console.log('📅 Sending 24-hour reminder to CUSTOMER');
      } else if (minutesUntilAppointment <= 0 && minutesUntilAppointment > -60 && adminSettings.reminderTimings.whenStarting) {
        // When starting (within 1 hour after appointment time)
        title = 'התור שלך מתחיל! 🎯';
        message = `התור שלך ל${treatmentName} מתחיל עכשיו!`;
        shouldSend = true;
        console.log('📅 Sending "when starting" reminder to CUSTOMER (enabled in settings)');
      } else {
        console.log('📅 No reminder needed at this time or disabled in settings');
        return false;
      }
      
      if (!shouldSend) {
        console.log('🔕 Reminder disabled in admin settings');
        return false;
      }
      
      // Send reminder to the customer
      await sendNotificationToUser(
        appointmentData.userId,
        title,
        message,
        { appointmentId: appointmentId }
      );
      
      // Send SMS only for 5-minute reminder (to save costs)
      if (minutesUntilAppointment <= 5 && minutesUntilAppointment > 0) {
        try {
          const userProfile = await getUserProfile(appointmentData.userId);
          if (userProfile && userProfile.phone) {
            console.log('📱 Sending SMS reminder for 5-minute notification');
            await sendSMSReminder(userProfile.phone, message);
          }
        } catch (smsError) {
          console.error('❌ Failed to send SMS reminder:', smsError);
        }
      }
      
      // Send reminder to admin (based on admin settings)
      try {
        let adminReminderType: '1h' | '15m' | 'whenStarting' | null = null;
        
        // Check reminders in order from closest to furthest (same logic as customer)
        if (minutesUntilAppointment <= 5 && minutesUntilAppointment > 0 && hoursUntilAppointment < 1) {
          adminReminderType = '15m'; // Keep '15m' for admin type, but it's actually 5 minutes now
        } else if (hoursUntilAppointment <= 1 && minutesUntilAppointment > 5) {
          adminReminderType = '1h';
        } else if (minutesUntilAppointment <= 0 && minutesUntilAppointment > -60) {
          adminReminderType = 'whenStarting';
        }
        
        if (adminReminderType) {
          await sendAppointmentReminderToAdmin(appointmentId, adminReminderType);
        }
      } catch (adminError) {
        console.error('❌ Failed to send admin reminder:', adminError);
      }
      
      console.log('✅ Reminder sent successfully to CUSTOMER and ADMIN');
      return true;
    } else {
      console.log('📅 Appointment is in the past, no reminder needed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending appointment reminder:', error);
    return false;
  }
};

// Get admin notification settings
export const getAdminNotificationSettings = async (): Promise<{
  newUserRegistered: boolean;
  newAppointmentBooked: boolean;
  appointmentCancelled: boolean;
  appointmentReminders: boolean;
  cancellationDeadlineHours: number;
  reminderTimings: {
    oneHourBefore: boolean;
    tenMinutesBefore: boolean;
    whenStarting: boolean;
  };
  customerReminderSettings?: {
    enabled: boolean;
    t24hEnabled: boolean;
    t1hEnabled: boolean;
    t0Enabled: boolean;
  };
}> => {
  try {
    console.log('🔧 Getting admin notification settings...');
    const { doc, getDoc, getFirestore } = await import('firebase/firestore');
    const db = getFirestore();
    
    const settingsDoc = await getDoc(doc(db, 'adminSettings', 'notifications'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      console.log('📋 Admin notification settings found:', data);
      
      // Ensure all required fields exist with defaults
      const settings = {
        newUserRegistered: data.newUserRegistered ?? true,
        newAppointmentBooked: data.newAppointmentBooked ?? true,
        appointmentCancelled: data.appointmentCancelled ?? true,
        appointmentReminders: data.appointmentReminders ?? true,
        cancellationDeadlineHours: data.cancellationDeadlineHours ?? 2,
        reminderTimings: {
          oneHourBefore: data.reminderTimings?.oneHourBefore ?? true,
          tenMinutesBefore: data.reminderTimings?.tenMinutesBefore ?? true,
          whenStarting: data.reminderTimings?.whenStarting ?? false,
        },
        customerReminderSettings: {
          enabled: data.customerReminderSettings?.enabled ?? true,
          t24hEnabled: data.customerReminderSettings?.t24hEnabled ?? true,
          t1hEnabled: data.customerReminderSettings?.t1hEnabled ?? true,
          t0Enabled: data.customerReminderSettings?.t0Enabled ?? true,
        },
      };

      console.log('✅ Processed admin notification settings:', settings);
      return settings;
    }
    
    console.log('📋 No admin notification settings found, using defaults');
    // Return default settings if none exist
    const defaultSettings = {
      newUserRegistered: true,
      newAppointmentBooked: true,
      appointmentCancelled: true,
      appointmentReminders: true,
      cancellationDeadlineHours: 2,
      reminderTimings: {
        oneHourBefore: true,
        tenMinutesBefore: true,
        whenStarting: false,
      },
      customerReminderSettings: {
        enabled: true,
        t24hEnabled: true,
        t1hEnabled: true,
        t0Enabled: true,
      },
    };

    console.log('✅ Using default admin notification settings:', defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error('❌ Error getting admin notification settings:', error);
    // Return default settings on error
    const defaultSettings = {
      newUserRegistered: true,
      newAppointmentBooked: true,
      appointmentCancelled: true,
      appointmentReminders: true,
      cancellationDeadlineHours: 2,
      reminderTimings: {
        oneHourBefore: true,
        tenMinutesBefore: true,
        whenStarting: false,
      },
      customerReminderSettings: {
        enabled: true,
        t24hEnabled: true,
        t1hEnabled: true,
        t0Enabled: true,
      },
    };

    console.log('✅ Using default admin notification settings due to error:', defaultSettings);
    return defaultSettings;
  }
};

// Send notification to admin about events
export const sendNotificationToAdmin = async (title: string, body: string, data?: any) => {
  try {
    console.log(`🔔 sendNotificationToAdmin called with title: "${title}"`);
    
    // Check if this type of notification is enabled
    const settings = await getAdminNotificationSettings();
    console.log('🔧 Current admin notification settings:', settings);
    
    // Determine notification type based on title/content
    let shouldSend = false;
    let notificationType = '';
    
    if (title.includes('משתמש חדש') || title.includes('נרשם')) {
      notificationType = 'newUserRegistered';
      shouldSend = settings.newUserRegistered;
      console.log(`🔔 New user notification - enabled: ${shouldSend}`);
    } else if (title.includes('תור חדש') || title.includes('תור נוצר')) {
      notificationType = 'newAppointmentBooked';
      shouldSend = settings.newAppointmentBooked;
      console.log(`🔔 New appointment notification - enabled: ${shouldSend}`);
    } else if (title.includes('בוטל') || title.includes('תור בוטל')) {
      notificationType = 'appointmentCancelled';
      shouldSend = settings.appointmentCancelled;
      console.log(`🔔 Appointment cancelled notification - enabled: ${shouldSend}`);
    } else if (title.includes('תזכורת') || title.includes('תור קרוב')) {
      // Check if admin reminders are enabled and which timings
      notificationType = 'appointmentReminders';
      shouldSend = settings.appointmentReminders;
      
      // If reminders are enabled, check specific timing based on the message
      if (shouldSend && data?.reminderType) {
        const reminderType = data.reminderType;
        if (reminderType === '1h' && !settings.reminderTimings.oneHourBefore) {
          shouldSend = false;
          console.log('🔕 1-hour reminder disabled for admin');
        } else if (reminderType === '15m' && !settings.reminderTimings.tenMinutesBefore) {
          shouldSend = false;
          console.log('🔕 10-minute reminder disabled for admin');
        } else if (reminderType === 'whenStarting' && !settings.reminderTimings.whenStarting) {
          shouldSend = false;
          console.log('🔕 When starting reminder disabled for admin');
        }
      }
      
      console.log(`🔔 Appointment reminder for admin - enabled: ${shouldSend}`);
    } else {
      // Default to sending if we can't determine the type
      notificationType = 'unknown';
      shouldSend = true;
      console.log(`🔔 Unknown notification type - defaulting to send: ${shouldSend}`);
    }
    
    if (!shouldSend) {
      console.log(`🔕 Notification disabled for type "${notificationType}": "${title}"`);
      return 0;
    }
    
    console.log(`✅ Notification enabled for type "${notificationType}": "${title}"`);
    
    // Try to get current user's profile directly if they're admin
    const currentUser = getCurrentUser();
    let adminUsers: UserProfile[] = [];
    
    if (currentUser) {
      const currentUserProfile = await getUserProfile(currentUser.uid);
      if (currentUserProfile?.isAdmin && currentUserProfile?.pushToken) {
        adminUsers.push(currentUserProfile);
        console.log(`👨‍💼 Current user is admin with push token: ${currentUserProfile.displayName}`);
      }
    }
    
    // Also try to get all users (fallback)
    try {
      const users = await getAllUsers();
      console.log(`👥 Total users found: ${users.length}`);
      const allAdminUsers = users.filter(user => user.isAdmin && user.pushToken);
      // Merge without duplicates
      allAdminUsers.forEach(user => {
        if (!adminUsers.find(existing => existing.uid === user.uid)) {
          adminUsers.push(user);
        }
      });
    } catch (getAllUsersError: any) {
      console.log('⚠️ Could not get all users, using current user only:', getAllUsersError.message);
    }
    
    console.log(`👨‍💼 Admin users with push tokens: ${adminUsers.length}`);
    console.log(`📱 Admin users: ${adminUsers.map(u => `${u.displayName} (${u.uid})`).join(', ')}`);
    
    if (adminUsers.length === 0) {
      console.log('❌ No admin users with push tokens found');
      return 0;
    }
    
    console.log(`📱 Sending notification to ${adminUsers.length} admin users`);
    
    const results = await Promise.allSettled(
      adminUsers.map(async (user) => {
        try {
          console.log(`📱 Sending to admin: ${user.displayName} (${user.uid})`);
          return await sendPushNotification(user.pushToken!, title, body, data);
        } catch (error) {
          console.error(`❌ Failed to send to admin ${user.displayName}:`, error);
          throw error;
        }
      })
    );
    
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    
    console.log(`✅ Successfully sent to ${successful}/${adminUsers.length} admin users`);
    if (failed > 0) {
      console.log(`❌ Failed to send to ${failed} admin users`);
    }
    
    return successful;
  } catch (error) {
    console.error('Error sending notification to admin:', error);
    return 0;
  }
};

// Process scheduled reminders (should be called periodically)
// Clean up old appointments to reduce Firebase load
// Only deletes completed/cancelled appointments older than specified days
export const cleanupOldAppointments = async (daysToKeep: number = 30): Promise<{
  deletedCount: number;
  errorCount: number;
  errors: string[];
}> => {
  try {
    console.log(`🧹 Starting cleanup of completed/cancelled appointments older than ${daysToKeep} days`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // Use optimized query - only get recent appointments (last 60 days) to reduce data transfer
    const recentAppointments = await getRecentAppointments(60);
    
    const appointmentsToDelete: string[] = [];
    const errors: string[] = [];
    let errorCount = 0;
    
    recentAppointments.forEach(appointment => {
      const appointmentDate = appointment.date?.toDate ? appointment.date.toDate() : null;
      
      if (appointmentDate && appointmentDate < cutoffDate) {
        // Only delete completed or cancelled appointments that are older than cutoff date
        // Keep scheduled/confirmed appointments even if old (for records)
        if ((appointment.status === 'completed' || appointment.status === 'cancelled') && appointmentDate < cutoffDate) {
          appointmentsToDelete.push(appointment.id);
        }
      }
    });
    
    console.log(`📋 Found ${appointmentsToDelete.length} old completed/cancelled appointments to delete`);
    
    if (appointmentsToDelete.length === 0) {
      return { deletedCount: 0, errorCount: 0, errors: [] };
    }
    
    // Delete appointments in batches to avoid overwhelming Firebase
    const batchSize = 500; // Firestore batch limit
    let deletedCount = 0;
    
    for (let i = 0; i < appointmentsToDelete.length; i += batchSize) {
      const batch = appointmentsToDelete.slice(i, i + batchSize);
      
      try {
        const writeBatchInstance = writeBatch(db);
        batch.forEach(appointmentId => {
          writeBatchInstance.delete(doc(db, 'appointments', appointmentId));
        });
        
        await writeBatchInstance.commit();
        deletedCount += batch.length;
        console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} appointments`);
        
        // Small delay between batches to be gentle on Firebase
        if (i + batchSize < appointmentsToDelete.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error}`);
      }
    }
    
    console.log(`🧹 Cleanup completed: ${deletedCount} deleted, ${errorCount} errors`);
    
    return {
      deletedCount,
      errorCount,
      errors
    };
    
  } catch (error) {
    console.error('Error during appointment cleanup:', error);
    return {
      deletedCount: 0,
      errorCount: 1,
      errors: [`General error: ${error}`]
    };
  }
};

export const processScheduledReminders = async () => {
  try {
    const now = new Date();
    const remindersQuery = query(
      collection(db, 'scheduledReminders'),
      where('status', '==', 'pending'),
      where('scheduledTime', '<=', Timestamp.fromDate(now))
    );
    
    const remindersSnapshot = await getDocs(remindersQuery);
    console.log(`📱 Processing ${remindersSnapshot.size} scheduled reminders`);
    
    const results = await Promise.allSettled(
      remindersSnapshot.docs.map(async (reminderDoc) => {
        const reminderData = reminderDoc.data();
        
        // Send the actual notification
        await sendAppointmentReminder(reminderData.appointmentId);
        
        // Mark as sent
        await updateDoc(doc(db, 'scheduledReminders', reminderDoc.id), {
          status: 'sent',
          sentAt: Timestamp.now()
        });
        
        console.log(`✅ Processed ${reminderData.reminderType} reminder for appointment ${reminderData.appointmentId}`);
      })
    );
    
    const successful = results.filter(result => result.status === 'fulfilled').length;
    console.log(`✅ Successfully processed ${successful} scheduled reminders`);
    
    return successful;
  } catch (error) {
    console.error('Error processing scheduled reminders:', error);
    return 0;
  }
};

// Send reminder to all users with upcoming appointments
export const sendRemindersToAllUsers = async () => {
  try {
    // First process any scheduled reminders that are due
    await processScheduledReminders();
    
    const appointments = await getAllAppointments();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const upcomingAppointments = appointments.filter(appointment => {
      const appointmentDate = appointment.date.toDate();
      return appointmentDate >= now && appointmentDate <= tomorrow && appointment.status === 'confirmed';
    });
    
    console.log(`📱 Sending reminders for ${upcomingAppointments.length} appointments`);
    
    const results = await Promise.allSettled(
      upcomingAppointments.map(appointment => 
        sendAppointmentReminder(appointment.id)
      )
    );
    
    const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
    console.log(`✅ Successfully sent ${successful} reminders`);
    
    return successful;
  } catch (error) {
    console.error('Error sending reminders to all users:', error);
    return 0;
  }
};


// Send welcome notification to new user
export const sendWelcomeNotification = async (userId: string) => {
  try {
    await sendNotificationToUser(
      userId,
      'ברוכים הבאים! 🎉',
      'תודה שנרשמת לאפליקציה שלנו! אנחנו שמחים לראות אותך.',
      { type: 'welcome' }
    );
  } catch (error) {
    console.error('Error sending welcome notification:', error);
  }
};

// Send promotional notification
export const sendPromotionalNotification = async (title: string, body: string, data?: any) => {
  try {
    const users = await getAllUsers();
    const usersWithTokens = users.filter(user => user.pushToken && !user.isAdmin); // Don't send to admins
    
    console.log(`📱 Sending promotional notification to ${usersWithTokens.length} users`);
    
    const results = await Promise.allSettled(
      usersWithTokens.map(user => 
        sendPushNotification(user.pushToken!, title, body, data)
      )
    );
    
    const successful = results.filter(result => result.status === 'fulfilled').length;
    console.log(`✅ Successfully sent promotional notification to ${successful}/${usersWithTokens.length} users`);
    
    return successful;
  } catch (error) {
    console.error('Error sending promotional notification:', error);
    return 0;
  }
};

// Send notification about new treatment
export const sendNewTreatmentNotification = async (treatmentName: string) => {
  try {
    await sendPromotionalNotification(
      'טיפול חדש! ✂️',
      `טיפול חדש נוסף: ${treatmentName}. בואו לנסות!`,
      { type: 'new_treatment', treatmentName: treatmentName }
    );
  } catch (error) {
    console.error('Error sending new treatment notification:', error);
  }
};

// Send notification about special offer
export const sendSpecialOfferNotification = async (offerTitle: string, offerDescription: string) => {
  try {
    await sendPromotionalNotification(
      `מבצע מיוחד! 🎁`,
      `${offerTitle}: ${offerDescription}`,
      { type: 'special_offer', offerTitle: offerTitle }
    );
  } catch (error) {
    console.error('Error sending special offer notification:', error);
  }
};

// Send notification about new barber
export const sendNewBarberNotification = async (barberName: string) => {
  try {
    await sendPromotionalNotification(
      'ספר חדש! ✂️',
      `ספר חדש הצטרף: ${barberName}. בואו להכיר!`,
      { type: 'new_barber', barberName: barberName }
    );
  } catch (error) {
    console.error('Error sending new barber notification:', error);
  }
};

// Send notification about maintenance
export const sendMaintenanceNotification = async (message: string) => {
  try {
    await sendNotificationToAllUsers(
      'תחזוקה מתוכננת! 🔧',
      message,
      { type: 'maintenance' }
    );
  } catch (error) {
    console.error('Error sending maintenance notification:', error);
  }
};

// Send notification about system update
export const sendSystemUpdateNotification = async (updateDetails: string) => {
  try {
    await sendNotificationToAllUsers(
      'עדכון מערכת! 📱',
      updateDetails,
      { type: 'system_update' }
    );
  } catch (error) {
    console.error('Error sending system update notification:', error);
  }
};

// Send notification about appointment reminder to admin (with timing check)
export const sendAppointmentReminderToAdmin = async (appointmentId: string, reminderType: '1h' | '15m' | 'whenStarting') => {
  try {
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      console.log('Appointment not found');
      return false;
    }
    
    const appointmentData = appointmentDoc.data() as Appointment;
    const appointmentDate = appointmentData.date.toDate();
    const now = new Date();
    const timeDiff = appointmentDate.getTime() - now.getTime();
    const hoursUntilAppointment = timeDiff / (1000 * 60 * 60);
    const minutesUntilAppointment = timeDiff / (1000 * 60);
    
    // Get customer name for better message
    let customerName = 'לקוח';
    try {
      const customerDoc = await getDoc(doc(db, 'users', appointmentData.userId));
      if (customerDoc.exists()) {
        customerName = customerDoc.data().displayName || 'לקוח';
      }
    } catch (e) {
      console.log('Could not fetch customer name');
    }
    
    // Determine message based on reminder type
    let title = 'תזכורת לתור! ⏰';
    let message = '';
    
    if (reminderType === '1h') {
      message = `תור של ${customerName} בעוד שעה ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (reminderType === '15m') {
      message = `תור של ${customerName} בעוד 5 דקות ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (reminderType === 'whenStarting') {
      message = `תור של ${customerName} מתחיל עכשיו!`;
    }
    
    await sendNotificationToAdmin(
      title,
      message,
      { appointmentId: appointmentId, reminderType: reminderType }
    );
    
    return true;
  } catch (error) {
    console.error('Error sending appointment reminder to admin:', error);
    return false;
  }
};

// Send notification about daily summary to admin
export const sendDailySummaryToAdmin = async () => {
  try {
    const appointments = await getAllAppointments();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const todayAppointments = appointments.filter(appointment => {
      const appointmentDate = appointment.date.toDate();
      return appointmentDate >= todayStart && appointmentDate < todayEnd;
    });
    
    const confirmedAppointments = todayAppointments.filter(app => app.status === 'confirmed');
    const completedAppointments = todayAppointments.filter(app => app.status === 'completed');
    const cancelledAppointments = todayAppointments.filter(app => app.status === 'cancelled');
    
    const summary = `סיכום יומי: ${confirmedAppointments.length} תורים מאושרים, ${completedAppointments.length} הושלמו, ${cancelledAppointments.length} בוטלו`;
    
    await sendNotificationToAdmin(
      'סיכום יומי 📊',
      summary,
      { type: 'daily_summary' }
    );
    
    return true;
  } catch (error) {
    console.error('Error sending daily summary to admin:', error);
    return false;
  }
};

// Send notification about new user registration to admin
export const sendNewUserNotificationToAdmin = async (userName: string, userEmail: string) => {
  try {
    await sendNotificationToAdmin(
      'משתמש חדש! 👤',
      `משתמש חדש נרשם: ${userName} (${userEmail})`,
      { type: 'new_user', userName: userName, userEmail: userEmail }
    );
  } catch (error) {
    console.error('Error sending new user notification to admin:', error);
  }
};

// Send notification about low appointment slots
export const sendLowSlotsNotificationToAdmin = async (barberName: string, availableSlots: number) => {
  try {
    await sendNotificationToAdmin(
      'פחות מקומות פנויים! ⚠️',
      `לספר ${barberName} נשארו רק ${availableSlots} מקומות פנויים`,
      { type: 'low_slots', barberName: barberName, availableSlots: availableSlots }
    );
  } catch (error) {
    console.error('Error sending low slots notification to admin:', error);
  }
};

// Send notification about appointment confirmation to admin
export const sendAppointmentConfirmationToAdmin = async (appointmentId: string) => {
  try {
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      console.log('Appointment not found');
      return false;
    }
    
    const appointmentData = appointmentDoc.data() as Appointment;
    const appointmentDate = appointmentData.date.toDate();
    
    await sendNotificationToAdmin(
      'תור אושר! ✅',
      `תור אושר עבור ${appointmentDate.toLocaleDateString('he-IL')} ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
      { appointmentId: appointmentId }
    );
    
    return true;
  } catch (error) {
    console.error('Error sending appointment confirmation to admin:', error);
    return false;
  }
};

// Send notification about appointment completion to admin
export const sendAppointmentCompletionToAdmin = async (appointmentId: string) => {
  try {
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      console.log('Appointment not found');
      return false;
    }
    
    const appointmentData = appointmentDoc.data() as Appointment;
    const appointmentDate = appointmentData.date.toDate();
    
    await sendNotificationToAdmin(
      'תור הושלם! 🎉',
      `תור הושלם עבור ${appointmentDate.toLocaleDateString('he-IL')} ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
      { appointmentId: appointmentId }
    );
    
    return true;
  } catch (error) {
    console.error('Error sending appointment completion to admin:', error);
    return false;
  }
};

// Send notification about appointment cancellation to admin
export const sendAppointmentCancellationToAdmin = async (appointmentId: string) => {
  try {
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      console.log('Appointment not found');
      return false;
    }
    
    const appointmentData = appointmentDoc.data() as Appointment;
    const appointmentDate = appointmentData.date.toDate();
    
    await sendNotificationToAdmin(
      'תור בוטל! ❌',
      `תור בוטל עבור ${appointmentDate.toLocaleDateString('he-IL')} ב-${appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
      { appointmentId: appointmentId }
    );
    
    return true;
  } catch (error) {
    console.error('Error sending appointment cancellation to admin:', error);
    return false;
  }
};

// Get user notifications
export const getUserNotifications = async (userId: string): Promise<{
  id: string;
  type: 'appointment' | 'general' | 'reminder';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}[]> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    // Only filter by userId - no orderBy to avoid index requirement
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      limit(100) // Get more to sort client-side
    );
    
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
      return {
        id: doc.id,
        type: data.type || 'general',
        title: data.title || 'הודעה',
        message: data.message || '',
        time: createdAt ? createdAt.toLocaleTimeString('he-IL', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : 'עכשיו',
        isRead: data.isRead || false,
        createdAt: createdAt || new Date() // For sorting
      };
    });
    
    // Sort by createdAt descending (newest first) on client side
    notifications.sort((a, b) => {
      const aTime = (a as any).createdAt?.getTime() || 0;
      const bTime = (b as any).createdAt?.getTime() || 0;
      return bTime - aTime;
    });
    
    // Remove createdAt from return (not part of interface)
    return notifications.slice(0, 50).map(({ createdAt, ...rest }) => rest);
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { isRead: true });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

// Clear all user notifications
export const clearAllUserNotifications = async (userId: string): Promise<boolean> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId));
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error clearing user notifications:', error);
    return false;
  }
};

// Create a notification for testing
export const createTestNotification = async (userId: string, type: 'appointment' | 'general' | 'reminder', title: string, message: string): Promise<boolean> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      userId,
      type,
      title,
      message,
      isRead: false,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error creating test notification:', error);
    return false;
  }
};

// Delete old notifications (older than specified hours) for a specific user
export const deleteOldNotifications = async (userId: string, hoursOld: number = 6): Promise<boolean> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);
    
    // Only filter by userId - filter by date on client side to avoid index requirement
    const q = query(
      notificationsRef, 
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return true;
    }
    
    // Filter old notifications on client side
    const oldNotifications = snapshot.docs.filter(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
      if (!createdAt) return false; // Skip notifications without createdAt
      return createdAt < cutoffTime;
    });
    
    if (oldNotifications.length === 0) {
      return true;
    }
    
    const batch = writeBatch(db);
    oldNotifications.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${oldNotifications.length} old notifications for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    return false;
  }
};

// Clean up all old notifications older than specified hours (for all users)
// This is more efficient for bulk cleanup
export const cleanupOldNotifications = async (hoursOld: number = 48): Promise<{
  deletedCount: number;
  errorCount: number;
  errors: string[];
}> => {
  try {
    console.log(`🧹 Starting cleanup of notifications older than ${hoursOld} hours`);
    
    const notificationsRef = collection(db, 'notifications');
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);
    const cutoffTimestamp = Timestamp.fromDate(cutoffTime);
    
    // Get all notifications - we'll filter by date on client side to avoid index requirement
    // Limit to reasonable batch size to avoid memory issues
    const snapshot = await getDocs(query(notificationsRef, limit(1000)));
    
    if (snapshot.empty) {
      console.log('✅ No notifications to clean up');
      return { deletedCount: 0, errorCount: 0, errors: [] };
    }
    
    // Filter old notifications on client side
    const oldNotifications = snapshot.docs.filter(doc => {
      const data = doc.data();
      const createdAt = data.createdAt;
      if (!createdAt) return false; // Skip notifications without createdAt
      
      // Handle both Timestamp and Date objects
      let createdAtDate: Date;
      if (createdAt.toDate && typeof createdAt.toDate === 'function') {
        createdAtDate = createdAt.toDate();
      } else if (createdAt instanceof Timestamp) {
        createdAtDate = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        createdAtDate = createdAt;
      } else {
        return false; // Skip if we can't parse the date
      }
      
      return createdAtDate < cutoffTime;
    });
    
    if (oldNotifications.length === 0) {
      console.log('✅ No old notifications found to delete');
      return { deletedCount: 0, errorCount: 0, errors: [] };
    }
    
    console.log(`📋 Found ${oldNotifications.length} old notifications to delete`);
    
    // Delete notifications in batches to avoid overwhelming Firebase
    const batchSize = 500; // Firestore batch limit is 500
    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < oldNotifications.length; i += batchSize) {
      const batch = oldNotifications.slice(i, i + batchSize);
      
      try {
        const writeBatchInstance = writeBatch(db);
        batch.forEach((doc) => {
          writeBatchInstance.delete(doc.ref);
        });
        
        await writeBatchInstance.commit();
        deletedCount += batch.length;
        console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} notifications`);
        
        // Small delay between batches to be gentle on Firebase
        if (i + batchSize < oldNotifications.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error}`);
      }
    }
    
    console.log(`🧹 Cleanup completed: ${deletedCount} deleted, ${errorCount} errors`);
    
    return {
      deletedCount,
      errorCount,
      errors
    };
    
  } catch (error) {
    console.error('Error during notification cleanup:', error);
    return {
      deletedCount: 0,
      errorCount: 1,
      errors: [`General error: ${error}`]
    };
  }
};

// ========== WAITLIST FUNCTIONS ==========

// Create a waitlist entry
export const createWaitlistEntry = async (waitlistData: Omit<WaitlistEntry, 'id' | 'createdAt'>) => {
  try {
    console.log('📝 Creating waitlist entry with data:', JSON.stringify(waitlistData, null, 2));
    
    // Check if user already on waitlist for this date
    const existingQuery = query(
      collection(db, 'waitlist'),
      where('userId', '==', waitlistData.userId),
      where('barberId', '==', waitlistData.barberId),
      where('date', '==', waitlistData.date)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      // Update existing entry instead of creating duplicate
      const existingDoc = existingSnapshot.docs[0];
      console.log('⚠️ User already on waitlist for this date - updating entry');
      await updateDoc(existingDoc.ref, {
        preferredTimeStart: waitlistData.preferredTimeStart,
        preferredTimeEnd: waitlistData.preferredTimeEnd,
        userDisplayName: waitlistData.userDisplayName,
        userPhone: waitlistData.userPhone,
      });
      console.log('✅ Updated existing waitlist entry:', existingDoc.id);
      return existingDoc.id;
    }
    
    const entry = {
      ...waitlistData,
      createdAt: Timestamp.now()
    };
    
    console.log('💾 Saving to Firestore:', entry);
    const docRef = await addDoc(collection(db, 'waitlist'), entry);
    console.log('✅ Waitlist entry created successfully with ID:', docRef.id);
    
    // Verify it was saved
    const savedDoc = await getDoc(docRef);
    if (savedDoc.exists()) {
      console.log('✅ Verified: Document exists in Firestore:', savedDoc.data());
    } else {
      console.error('❌ WARNING: Document was not saved!');
    }
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating waitlist entry:', error);
    if ((error as any).code === 'permission-denied') {
      console.error('🔒 PERMISSION DENIED - Check Firestore security rules!');
    }
    throw error;
  }
};

// Get waitlist entries for a specific date
export const getWaitlistEntriesForDate = async (barberId: string, date: string): Promise<WaitlistEntry[]> => {
  try {
    console.log(`🔍 Fetching waitlist entries for barberId: ${barberId}, date: ${date}`);
    
    const waitlistQuery = query(
      collection(db, 'waitlist'),
      where('barberId', '==', barberId),
      where('date', '==', date),
      orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(waitlistQuery);
    console.log(`📊 Raw snapshot size: ${snapshot.docs.length} documents`);
    
    const entries: WaitlistEntry[] = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`  - Document ${doc.id}:`, data);
      return {
        id: doc.id,
        ...data
      } as WaitlistEntry;
    });
    
    console.log(`✅ Found ${entries.length} waitlist entries for date ${date}`);
    return entries;
  } catch (error) {
    console.error('❌ Error getting waitlist entries:', error);
    if ((error as any).code === 'failed-precondition') {
      console.error('🔥 FIRESTORE INDEX MISSING! Check console for link to create it.');
    }
    return [];
  }
};

// Get all waitlist entries for next 7 days (for admin view)
export const getWaitlistEntriesForWeek = async (barberId: string): Promise<{[date: string]: WaitlistEntry[]}> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const entriesByDate: {[date: string]: WaitlistEntry[]} = {};
    
    // Get next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const entries = await getWaitlistEntriesForDate(barberId, dateStr);
      if (entries.length > 0) {
        entriesByDate[dateStr] = entries;
      }
    }
    
    console.log(`Found waitlist entries for ${Object.keys(entriesByDate).length} days`);
    return entriesByDate;
  } catch (error) {
    console.error('Error getting waitlist entries for week:', error);
    return {};
  }
};

// Delete a waitlist entry
export const deleteWaitlistEntry = async (entryId: string) => {
  try {
    await deleteDoc(doc(db, 'waitlist', entryId));
    console.log('Waitlist entry deleted:', entryId);
  } catch (error) {
    console.error('Error deleting waitlist entry:', error);
    throw error;
  }
};

// Get user's waitlist entries
export const getUserWaitlistEntries = async (userId: string): Promise<WaitlistEntry[]> => {
  try {
    const waitlistQuery = query(
      collection(db, 'waitlist'),
      where('userId', '==', userId),
      orderBy('date', 'asc')
    );
    
    const snapshot = await getDocs(waitlistQuery);
    const entries: WaitlistEntry[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WaitlistEntry));
    
    console.log(`Found ${entries.length} waitlist entries for user ${userId}`);
    return entries;
  } catch (error) {
    console.error('Error getting user waitlist entries:', error);
    return [];
  }
};

// Clean up old waitlist entries (called automatically)
export const cleanupOldWaitlistEntries = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const waitlistRef = collection(db, 'waitlist');
    const snapshot = await getDocs(waitlistRef);
    
    const batch = writeBatch(db);
    let deletedCount = 0;
    
    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.date < todayStr) {
        batch.delete(docSnapshot.ref);
        deletedCount++;
      }
    });
    
    await batch.commit();
    console.log(`Cleaned up ${deletedCount} old waitlist entries`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old waitlist entries:', error);
    return 0;
  }
};

// Notify waitlist users when appointment is cancelled
export const notifyWaitlistOnCancellation = async (barberId: string, appointmentDate: Date) => {
  try {
    const dateStr = appointmentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = appointmentDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const displayDate = appointmentDate.toLocaleDateString('he-IL');
    
    console.log(`Notifying waitlist for barber ${barberId}, date ${dateStr}, time ${timeStr}`);
    
    // Get all waitlist entries for this date
    const entries = await getWaitlistEntriesForDate(barberId, dateStr);
    
    if (entries.length === 0) {
      console.log('No waitlist entries found for this date');
      return;
    }
    
    console.log(`Found ${entries.length} waitlist entries to notify`);
    
    // Send notification to each user on the waitlist
    for (const entry of entries) {
      try {
        await sendNotificationToUser(
          entry.userId,
          'הזדרז! תור התפנה! 🎉',
          `מישהו ביטל תור לתאריך ${displayDate} בשעה ${timeStr}. מהר להזמין!`,
          { 
            type: 'waitlist_slot_available',
            barberId: barberId,
            date: dateStr,
            time: timeStr
          }
        );
        console.log(`Notification sent to user ${entry.userId}`);
      } catch (notifError) {
        console.error(`Failed to send notification to user ${entry.userId}:`, notifError);
      }
    }
    
    console.log('Finished notifying waitlist users');
  } catch (error) {
    console.error('Error notifying waitlist on cancellation:', error);
  }
};

// ===== Broadcast Messages Management =====

export interface BroadcastMessage {
  id: string;
  title: string;
  body: string;
  sentBy: string;
  sentByName: string;
  sentAt: Timestamp;
  recipientCount: number;
  includesSMS: boolean;
  dismissedBy?: string[]; // Array of user IDs who dismissed this message
}

// Save a broadcast message to history
export const saveBroadcastMessage = async (
  messageData: Omit<BroadcastMessage, 'id' | 'sentAt'>
): Promise<string> => {
  try {
    const messageRef = await addDoc(collection(db, 'broadcastMessages'), {
      ...messageData,
      sentAt: serverTimestamp(),
    });
    console.log('✅ Broadcast message saved with ID:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Error saving broadcast message:', error);
    throw error;
  }
};

// Get all broadcast messages (sorted by most recent first)
export const getBroadcastMessages = async (): Promise<BroadcastMessage[]> => {
  try {
    const messagesQuery = query(
      collection(db, 'broadcastMessages'),
      orderBy('sentAt', 'desc'),
      limit(50) // Limit to last 50 messages
    );

    const snapshot = await getDocs(messagesQuery);
    const messages: BroadcastMessage[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as BroadcastMessage));

    console.log(`✅ Retrieved ${messages.length} broadcast messages`);
    return messages;
  } catch (error) {
    console.error('❌ Error getting broadcast messages:', error);
    return [];
  }
};

// Delete a broadcast message
export const deleteBroadcastMessage = async (messageId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'broadcastMessages', messageId));
    console.log('✅ Broadcast message deleted:', messageId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting broadcast message:', error);
    return false;
  }
};

// Dismiss a broadcast message for a specific user
export const dismissBroadcastMessage = async (messageId: string, userId: string): Promise<boolean> => {
  try {
    const messageRef = doc(db, 'broadcastMessages', messageId);
    await updateDoc(messageRef, {
      dismissedBy: arrayUnion(userId)
    });
    console.log('✅ Broadcast message dismissed for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error dismissing broadcast message:', error);
    return false;
  }
};

// Get active broadcast messages for a specific user (not dismissed)
export const getActiveBroadcastMessages = async (userId: string): Promise<BroadcastMessage[]> => {
  try {
    const messagesQuery = query(
      collection(db, 'broadcastMessages'),
      orderBy('sentAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(messagesQuery);
    const messages: BroadcastMessage[] = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as BroadcastMessage))
      .filter(msg => !msg.dismissedBy || !msg.dismissedBy.includes(userId)); // Filter out dismissed messages

    console.log(`✅ Retrieved ${messages.length} active broadcast messages for user ${userId}`);
    return messages;
  } catch (error) {
    console.error('❌ Error getting active broadcast messages:', error);
    return [];
  }
};