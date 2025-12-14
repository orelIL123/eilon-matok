import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { loginUser, loginWithPhoneAndPassword, getUserProfile } from './firebase';
import { CacheUtils } from './cache';

interface LoginCredentials {
  email?: string;
  phoneNumber?: string;
  password: string;
  loginMethod: 'email' | 'phone';
  lastLoginTime: number;
  rememberMe: boolean;
}

interface AuthData {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  isAdmin: boolean;
  lastLoginAt: string;
  isAuthenticated: boolean;
}

export class AuthManager {
  private static instance: AuthManager;
  private currentUser: User | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];
  private isInitialized = false;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  constructor() {
    this.initializeAuthListener();
  }

  private initializeAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      console.log('🔥 AuthManager: Firebase auth state changed:', user ? 'User found' : 'No user');
      this.currentUser = user;
      this.isInitialized = true;

      if (user) {
        // שמירת auth data בcache
        await this.saveAuthDataToCache(user);
      } else {
        // ניקוי auth data מהcache
        await CacheUtils.clearAuthData();
        await CacheUtils.clearAuthState();
      }

      // הפעלת listeners
      this.authStateListeners.forEach(callback => {
        try {
          callback(user);
        } catch (error) {
          console.error('❌ AuthManager: Error in auth state listener:', error);
        }
      });
    });
  }

  // הוספת listener לשינויי auth state
  addAuthStateListener(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);

    // אם כבר יש user, קרא ל-callback מיד
    if (this.isInitialized) {
      callback(this.currentUser);
    }

    // החזרת פונקציה להסרת ה-listener
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  // שמירת login credentials
  async saveLoginCredentials(
    email?: string,
    phoneNumber?: string,
    password?: string,
    rememberMe: boolean = false
  ): Promise<void> {
    if (!rememberMe || !password) {
      console.log('🚫 AuthManager: Not saving credentials - rememberMe disabled or no password');
      return;
    }

    const credentials: LoginCredentials = {
      email,
      phoneNumber,
      password,
      loginMethod: email ? 'email' : 'phone',
      lastLoginTime: Date.now(),
      rememberMe,
    };

    await CacheUtils.setLoginCredentials(credentials);
    console.log('💾 AuthManager: Login credentials saved');
  }

  // קבלת saved credentials
  async getSavedCredentials(): Promise<LoginCredentials | null> {
    try {
      const credentials = await CacheUtils.getLoginCredentials();
      if (credentials && (credentials as LoginCredentials).rememberMe) {
        console.log('📖 AuthManager: Found saved credentials');
        return credentials as LoginCredentials;
      }
      return null;
    } catch (error) {
      console.error('❌ AuthManager: Error getting saved credentials:', error);
      return null;
    }
  }

  // auto login עם saved credentials
  async attemptAutoLogin(): Promise<boolean> {
    try {
      // ראשית בדיקה אם יש user מחובר ב-Firebase
      if (this.currentUser) {
        console.log('✅ AuthManager: Already authenticated via Firebase');
        return true;
      }

      console.log('🔍 AuthManager: Attempting auto-login with saved credentials...');
      const savedCredentials = await this.getSavedCredentials();

      if (!savedCredentials) {
        console.log('❌ AuthManager: No saved credentials found');
        return false;
      }

      // בדיקה אם הcredentials לא פגו תוקף (30 יום)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      if (savedCredentials.lastLoginTime < thirtyDaysAgo) {
        console.log('⏰ AuthManager: Saved credentials expired');
        await CacheUtils.clearLoginCredentials();
        return false;
      }

      // ביצוע auto-login
      const loginValue = savedCredentials.email || savedCredentials.phoneNumber;
      if (!loginValue) {
        console.log('❌ AuthManager: No email or phone in saved credentials');
        return false;
      }

      console.log(`🚀 AuthManager: Attempting auto-login for ${loginValue}`);

      if (savedCredentials.loginMethod === 'email' && savedCredentials.email) {
        await loginUser(savedCredentials.email, savedCredentials.password);
      } else if (savedCredentials.loginMethod === 'phone' && savedCredentials.phoneNumber) {
        await loginWithPhoneAndPassword(savedCredentials.phoneNumber, savedCredentials.password);
      }

      console.log('✅ AuthManager: Auto-login successful');
      return true;
    } catch (error) {
      console.error('❌ AuthManager: Auto-login failed:', error);

      // במקרה של failure, לנקות credentials פגומים
      await CacheUtils.clearLoginCredentials();
      return false;
    }
  }

  // שמירת auth data בcache
  private async saveAuthDataToCache(user: User): Promise<void> {
    try {
      // קבלת profile data
      let userProfile = null;
      try {
        userProfile = await getUserProfile(user.uid);
      } catch (error) {
        console.log('⚠️ AuthManager: Could not get user profile, continuing with basic data');
      }

      const authData: AuthData = {
        uid: user.uid,
        email: user.email || undefined,
        phoneNumber: user.phoneNumber || userProfile?.phone,
        displayName: userProfile?.displayName || user.displayName || undefined,
        isAdmin: userProfile?.isAdmin || false,
        lastLoginAt: new Date().toISOString(),
        isAuthenticated: true,
      };

      await CacheUtils.setAuthData(authData);
      await CacheUtils.setAuthState({ isAuthenticated: true, user: authData });

      console.log('💾 AuthManager: Auth data cached successfully');
    } catch (error) {
      console.error('❌ AuthManager: Error saving auth data to cache:', error);
    }
  }

  // קבלת current auth data
  async getAuthData(): Promise<AuthData | null> {
    try {
      // תחילה מהcache
      let authData = await CacheUtils.getAuthData();

      // אם יש Firebase user אבל לא cache, ניצור cache
      if (!authData && this.currentUser) {
        await this.saveAuthDataToCache(this.currentUser);
        authData = await CacheUtils.getAuthData();
      }

      return authData as AuthData | null;
    } catch (error) {
      console.error('❌ AuthManager: Error getting auth data:', error);
      return null;
    }
  }

  // בדיקה אם משתמש מחובר
  async isAuthenticated(): Promise<boolean> {
    try {
      // בדיקה ראשונה - Firebase current user
      if (this.currentUser) {
        return true;
      }

      // בדיקה שנייה - cached auth state
      const authState = await CacheUtils.getAuthState();
      if (authState && (authState as any).isAuthenticated) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ AuthManager: Error checking authentication:', error);
      return false;
    }
  }

  // התנתקות מלאה
  async logout(): Promise<void> {
    try {
      console.log('🚪 AuthManager: Logging out...');

      // ניקוי כל ה-cache
      await CacheUtils.invalidateAuthCaches();

      // התנתקות מFirebase (יפעיל את ה-listener)
      await auth.signOut();

      console.log('✅ AuthManager: Logout successful');
    } catch (error) {
      console.error('❌ AuthManager: Logout error:', error);
      throw error;
    }
  }

  // קבלת current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // בדיקה אם AuthManager מאותחל
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  // המתנה לאתחול
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }
}

// יצירת instance יחיד
export const authManager = AuthManager.getInstance();