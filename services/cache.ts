import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheManager {
  private static instance: CacheManager;
  private memoryCache = new Map<string, any>();

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // Set data in both memory and persistent cache
  async set<T>(key: string, data: T, ttlMinutes: number = 30): Promise<void> {
    const ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Store in memory for faster access
    this.memoryCache.set(key, cacheItem);

    // Store in AsyncStorage for persistence
    try {
      await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Error storing in cache:', error);
    }
  }

  // Get data from cache (memory first, then AsyncStorage)
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const cacheItem = this.memoryCache.get(key) as CacheItem<T>;
      if (this.isValid(cacheItem)) {
        return cacheItem.data;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check AsyncStorage
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const cacheItem: CacheItem<T> = JSON.parse(cached);
        if (this.isValid(cacheItem)) {
          // Store back in memory for faster future access
          this.memoryCache.set(key, cacheItem);
          return cacheItem.data;
        } else {
          // Remove expired cache
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }

    return null;
  }

  // Check if cache item is still valid
  private isValid<T>(cacheItem: CacheItem<T>): boolean {
    return Date.now() - cacheItem.timestamp < cacheItem.ttl;
  }

  // Clear specific cache entry
  async clear(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Clear all cache
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  // Get cache statistics
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      memoryKeys: Array.from(this.memoryCache.keys())
    };
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  BARBERS: 'cache_barbers',
  TREATMENTS: 'cache_treatments',
  GALLERY_IMAGES: 'cache_gallery_images',
  SETTINGS_IMAGES: 'cache_settings_images',
  USER_PROFILE: 'cache_user_profile',
  // Auth-related cache keys
  AUTH_DATA: 'cache_auth_data',
  LOGIN_CREDENTIALS: 'cache_login_credentials',
  AUTH_STATE: 'cache_auth_state',
} as const;

// Export singleton instance
export const cache = CacheManager.getInstance();

// Utility functions for specific data types
export const CacheUtils = {
  // Cache barbers data (updates rarely)
  async getBarbers() {
    return cache.get(CACHE_KEYS.BARBERS);
  },

  async setBarbers(barbers: any[], ttlMinutes: number = 60) {
    return cache.set(CACHE_KEYS.BARBERS, barbers, ttlMinutes);
  },

  // Cache treatments data (updates rarely)
  async getTreatments() {
    return cache.get(CACHE_KEYS.TREATMENTS);
  },

  async setTreatments(treatments: any[], ttlMinutes: number = 60) {
    return cache.set(CACHE_KEYS.TREATMENTS, treatments, ttlMinutes);
  },

  // Cache gallery images (updates occasionally)
  async getGalleryImages() {
    return cache.get(CACHE_KEYS.GALLERY_IMAGES);
  },

  async setGalleryImages(images: any[], ttlMinutes: number = 30) {
    return cache.set(CACHE_KEYS.GALLERY_IMAGES, images, ttlMinutes);
  },

  // Cache settings images (updates rarely)
  async getSettingsImages() {
    return cache.get(CACHE_KEYS.SETTINGS_IMAGES);
  },

  async setSettingsImages(settings: any, ttlMinutes: number = 120) {
    return cache.set(CACHE_KEYS.SETTINGS_IMAGES, settings, ttlMinutes);
  },

  // Clear specific caches
  async clearTreatments() {
    return cache.clear(CACHE_KEYS.TREATMENTS);
  },

  async clearBarbers() {
    return cache.clear(CACHE_KEYS.BARBERS);
  },

  async clearGalleryImages() {
    return cache.clear(CACHE_KEYS.GALLERY_IMAGES);
  },

  async clearSettingsImages() {
    return cache.clear(CACHE_KEYS.SETTINGS_IMAGES);
  },

  // Auth data utilities
  async getAuthData() {
    return cache.get(CACHE_KEYS.AUTH_DATA);
  },

  async setAuthData(authData: any, ttlMinutes: number = 60 * 24) { // 24 שעות
    return cache.set(CACHE_KEYS.AUTH_DATA, authData, ttlMinutes);
  },

  async getLoginCredentials() {
    return cache.get(CACHE_KEYS.LOGIN_CREDENTIALS);
  },

  async setLoginCredentials(credentials: any, ttlMinutes: number = 60 * 24 * 30) { // 30 יום
    return cache.set(CACHE_KEYS.LOGIN_CREDENTIALS, credentials, ttlMinutes);
  },

  async getAuthState() {
    return cache.get(CACHE_KEYS.AUTH_STATE);
  },

  async setAuthState(state: any, ttlMinutes: number = 60 * 24) { // 24 שעות
    return cache.set(CACHE_KEYS.AUTH_STATE, state, ttlMinutes);
  },

  // Clear auth caches
  async clearAuthData() {
    return cache.clear(CACHE_KEYS.AUTH_DATA);
  },

  async clearLoginCredentials() {
    return cache.clear(CACHE_KEYS.LOGIN_CREDENTIALS);
  },

  async clearAuthState() {
    return cache.clear(CACHE_KEYS.AUTH_STATE);
  },

  // Clear all auth caches
  async invalidateAuthCaches() {
    await Promise.all([
      cache.clear(CACHE_KEYS.AUTH_DATA),
      cache.clear(CACHE_KEYS.LOGIN_CREDENTIALS),
      cache.clear(CACHE_KEYS.AUTH_STATE),
      cache.clear(CACHE_KEYS.USER_PROFILE),
    ]);
    console.log('🧹 Cache: Auth caches invalidated');
  },

  // Clear data caches when admin makes changes
  async invalidateDataCaches() {
    await Promise.all([
      cache.clear(CACHE_KEYS.BARBERS),
      cache.clear(CACHE_KEYS.TREATMENTS),
      cache.clear(CACHE_KEYS.GALLERY_IMAGES),
      cache.clear(CACHE_KEYS.SETTINGS_IMAGES),
    ]);
  }
};