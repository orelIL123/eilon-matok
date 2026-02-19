import { useRouter } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { authManager } from '../services/authManager';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Track start time to ensure minimum 3 seconds display
    const startTime = Date.now();
    const MINIMUM_DISPLAY_TIME = 3000; // 3 seconds

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

        // Ensure minimum display time of 2 seconds
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsedTime);

        const navigate = (route: '/(tabs)' | '/auth-choice') => {
          const proceed = async () => {
            try {
              await ExpoSplashScreen.hideAsync();
            } catch {
              // splash may already be hidden
            }
            router.replace(route);
          };

          if (remainingTime > 0) {
            setTimeout(() => {
              proceed();
            }, remainingTime);
            return;
          }

          proceed();
        };

        if (isAuthenticated) {
          console.log('✅ SplashScreen: User already authenticated via Firebase persistence');
          navigate('/(tabs)');
          return;
        }

        // Second: Try auto-login with saved credentials
        console.log('🔍 SplashScreen: No Firebase auth, trying auto-login...');
        const autoLoginSuccess = await authManager.attemptAutoLogin();

        if (autoLoginSuccess) {
          console.log('✅ SplashScreen: Auto-login successful, navigating to home');
          navigate('/(tabs)');
        } else {
          console.log('❌ SplashScreen: No auto-login possible, navigating to auth choice');
          navigate('/auth-choice');
        }

      } catch (error) {
        console.error('❌ SplashScreen: Error in auth check:', error);

        // Ensure minimum display time even on error
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsedTime);

        const proceed = async () => {
          try {
            await ExpoSplashScreen.hideAsync();
          } catch {
            // splash may already be hidden
          }
          router.replace('/auth-choice');
        };

        if (remainingTime > 0) {
          setTimeout(() => {
            proceed();
          }, remainingTime);
          return;
        }

        proceed();
      }
    };

    // Start auth check immediately (minimum display time will be enforced)
    checkAuthState();
  }, [router]);

  return (
    <View style={styles.container}>
      {/* Native splash stays visible until hideAsync; keep black fallback under it */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
