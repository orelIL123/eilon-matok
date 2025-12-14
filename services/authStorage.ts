import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@barberapp:'; // שנה לשם האפליקציה שלך
const AUTH_STORAGE_KEY = `${PREFIX}auth`;

export interface AuthData {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  isAdmin: boolean;
  lastLoginAt: string;
  // Add credentials for auto-login
  savedCredentials?: {
    email?: string;
    phoneNumber?: string;
    password?: string; // Add password storage
    hasPassword: boolean;
  };
}

export const AuthStorageService = {
  // Save auth data
  async saveAuthData(authData: AuthData): Promise<void> {
    try {
      console.log('🔄 AuthStorageService: Starting to save auth data...');
      const dataToStore = {
        ...authData,
        lastLoginAt: new Date().toISOString()
      };
      
      console.log('💾 AuthStorageService: Data to store:', {
        uid: dataToStore.uid,
        email: dataToStore.email,
        phoneNumber: dataToStore.phoneNumber,
        displayName: dataToStore.displayName,
        isAdmin: dataToStore.isAdmin,
        savedCredentials: dataToStore.savedCredentials
      });
      
      const jsonData = JSON.stringify(dataToStore);
      console.log('📝 AuthStorageService: JSON data length:', jsonData.length);
      
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, jsonData);
      console.log('✅ AuthStorageService: Auth data saved successfully to AsyncStorage');
      
      // Verify the data was saved
      const savedData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (savedData) {
        console.log('✅ AuthStorageService: Data verification successful');
      } else {
        console.log('❌ AuthStorageService: Data verification failed - no data found');
      }
    } catch (error) {
      console.error('❌ AuthStorageService: Error saving auth data:', error);
    }
  },

  // Get saved auth data
  async getAuthData(): Promise<AuthData | null> {
    try {
      console.log('🔄 AuthStorageService: Loading auth data from AsyncStorage...');
      const data = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (data) {
        console.log('📖 AuthStorageService: Raw data found, length:', data.length);
        const authData = JSON.parse(data) as AuthData;
        console.log('📖 AuthStorageService: Parsed auth data:', {
          uid: authData.uid,
          email: authData.email,
          phoneNumber: authData.phoneNumber,
          displayName: authData.displayName,
          isAdmin: authData.isAdmin,
          savedCredentials: authData.savedCredentials
        });
        return authData;
      } else {
        console.log('ℹ️ AuthStorageService: No data found in AsyncStorage');
        return null;
      }
    } catch (error) {
      console.error('❌ AuthStorageService: Error loading auth data:', error);
      return null;
    }
  },

  // Clear auth data (logout) - מסונן לפי prefix
  async clearAuthData(): Promise<void> {
    try {
      // ❗️אל תשתמש ב-AsyncStorage.clear()
      const keys = await AsyncStorage.getAllKeys();
      const mine = keys.filter(k => k.startsWith(PREFIX));
      if (mine.length) await AsyncStorage.multiRemove(mine);
      console.log('🗑️ Auth data cleared (filtered by prefix)');
    } catch (error) {
      console.error('❌ Error clearing auth data:', error);
    }
  },

  // Check if user is logged in
  async isLoggedIn(): Promise<boolean> {
    try {
      const data = await this.getAuthData();
      return data !== null;
    } catch (error) {
      console.error('❌ Error checking login status:', error);
      return false;
    }
  },

  // Save login credentials for auto-login
  async saveLoginCredentials(email?: string, phoneNumber?: string, password?: string, hasPassword: boolean = false): Promise<void> {
    try {
      console.log('🔄 AuthStorageService: Saving login credentials...', { email, phoneNumber, hasPassword, passwordLength: password?.length });
      
      const currentData = await this.getAuthData();
      if (currentData) {
        const updatedData = {
          ...currentData,
          savedCredentials: {
            email,
            phoneNumber,
            password, // Save password if provided
            hasPassword
          }
        };
        await this.saveAuthData(updatedData);
        console.log('✅ AuthStorageService: Login credentials saved (including password)');
      } else {
        // If no current data, create new data with just credentials
        console.log('ℹ️ AuthStorageService: No current auth data - creating new data with credentials');
        const newData = {
          uid: 'temp', // Temporary UID
          email: email || undefined,
          phoneNumber: phoneNumber || undefined,
          displayName: '',
          isAdmin: false,
          lastLoginAt: new Date().toISOString(),
          savedCredentials: {
            email,
            phoneNumber,
            password,
            hasPassword
          }
        };
        await this.saveAuthData(newData);
        console.log('✅ AuthStorageService: New auth data created with credentials');
      }
    } catch (error) {
      console.error('❌ AuthStorageService: Error saving login credentials:', error);
    }
  },

  // Get saved login credentials
  async getSavedCredentials(): Promise<{email?: string, phoneNumber?: string, password?: string, hasPassword: boolean} | null> {
    try {
      console.log('🔄 AuthStorageService: Getting saved credentials...');
      const data = await this.getAuthData();
      if (data?.savedCredentials) {
        console.log('📖 AuthStorageService: Found saved credentials:', {
          email: data.savedCredentials.email,
          phoneNumber: data.savedCredentials.phoneNumber,
          hasPassword: data.savedCredentials.hasPassword,
          passwordSaved: !!data.savedCredentials.password
        });
        return data.savedCredentials;
      } else {
        console.log('ℹ️ AuthStorageService: No saved credentials found');
        return null;
      }
    } catch (error) {
      console.error('❌ AuthStorageService: Error getting saved credentials:', error);
      return null;
    }
  }
};

