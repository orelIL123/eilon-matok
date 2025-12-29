import { useRouter } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { authManager } from '../services/authManager';

// Keep the native splash screen visible while we're loading
ExpoSplashScreen.preventAutoHideAsync();

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = React.useRef(new Animated.Value(1)).current; // Start at 1 (visible immediately)

  useEffect(() => {
    // Hide native splash screen immediately when component mounts
    // The expo splash is already visible (opacity 1) so transition is seamless
    ExpoSplashScreen.hideAsync().catch(() => {
      // Ignore errors if splash is already hidden
    });

    // Check auth state using the new AuthManager
    let authStateChecked = false;

    const checkAuthState = async () => {
      try {
        console.log('🔍 SplashScreen: Starting auth check...');

        // Wait for AuthManager to initialize
        await authManager.waitForInitialization();

        if (authStateChecked) return;
        authStateChecked = true;

        console.log('🔍 SplashScreen: AuthManager initialized, checking auth state...');

        // Request notification permissions on first launch
        try {
          const { ensurePermissions } = await import('../services/notifications');
          await ensurePermissions();
          console.log('📱 Notification permissions requested');
        } catch (permError) {
          console.log('⚠️ Error requesting notification permissions:', permError);
        }

        // First: Check if already authenticated via Firebase persistence
        const isAuthenticated = await authManager.isAuthenticated();

        if (isAuthenticated) {
          console.log('✅ SplashScreen: User already authenticated via Firebase persistence');

          // Fade out and navigate to home
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            router.replace('/(tabs)');
          });
          return;
        }

        // Second: Try auto-login with saved credentials
        console.log('🔍 SplashScreen: No Firebase auth, trying auto-login...');
        const autoLoginSuccess = await authManager.attemptAutoLogin();

        // Fade out before navigation
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (autoLoginSuccess) {
            console.log('✅ SplashScreen: Auto-login successful, navigating to home');
            router.replace('/(tabs)');
          } else {
            console.log('❌ SplashScreen: No auto-login possible, navigating to auth choice');
            router.replace('/auth-choice');
          }
        });

      } catch (error) {
        console.error('❌ SplashScreen: Error in auth check:', error);

        // Fallback to auth choice on error
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          router.replace('/auth-choice');
        });
      }
    };

    // Start auth check immediately (no delay needed since native splash is already showing)
    checkAuthState();
  }, []);

  return (
    <View style={styles.container}>
      {/* Main splash image - full screen */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Image
          source={require('../assets/images/splash.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});