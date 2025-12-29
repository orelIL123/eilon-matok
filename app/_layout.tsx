import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import 'nativewind';
import { useEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Alert, AppState, AppStateStatus, View } from 'react-native';
import 'react-native-reanimated';
import '../app/globals.css';
import { auth } from '../config/firebase';
import { ensureAndroidChannel } from '../services/notifications';
import AppAuthGate from './components/AppAuthGate';
import i18n from './i18n';

import { useColorScheme } from '../hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before we're ready
SplashScreen.preventAutoHideAsync();

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Setup notification response handler (auth-aware)
  useEffect(() => {
    console.log('📱 Setting up auth-aware notification handler...');

    // Setup Android notification channel
    ensureAndroidChannel();

    // Handle notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📱 Notification tapped:', response.notification.request.content.data);

      const data = response.notification.request.content.data as any;

      // Check if user is authenticated
      const currentUser = auth.currentUser;

      if (!currentUser) {
        console.log('⚠️ User not authenticated, redirecting to auth-choice');
        // Not logged in - redirect to login
        router.replace('/auth-choice');
        return;
      }

      // User is authenticated - handle navigation based on notification data
      if (data?.appointmentId) {
        console.log('📅 Navigating to appointments (appointmentId:', data.appointmentId, ')');
        // Navigate to profile tab which shows appointments
        router.push('/(tabs)/profile');
      } else if (data?.type === 'appointment-reminder') {
        console.log('📅 Navigating to appointments (reminder)');
        router.push('/(tabs)/profile');
      } else {
        console.log('📱 Navigating to home');
        // Default navigation
        router.push('/(tabs)');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Note: Push token registration is now only done when user explicitly enables notifications
  // via settings or onboarding flow, not automatically on login

  // Check for updates on app start and auto-fetch in background
  useEffect(() => {
    async function checkAndFetchUpdates() {
      try {
        // Only check for updates in production
        if (!__DEV__) {
          console.log('🔄 Checking for EAS updates...');
          const update = await Updates.checkForUpdateAsync();
          
          if (update.isAvailable) {
            console.log('✅ Update available, fetching in background...');
            try {
              // Fetch update in background (non-blocking)
              await Updates.fetchUpdateAsync();
              console.log('✅ Update fetched successfully, reloading app...');
              // Reload app to apply update immediately
              await Updates.reloadAsync();
            } catch (fetchError) {
              console.error('❌ Error fetching update:', fetchError);
              // If fetch fails, show alert as fallback
              Alert.alert(
                'עדכון זמין',
                'יש עדכון חדש לאפליקציה. האם ברצונך להוריד אותו עכשיו?',
                [
                  {
                    text: 'לא עכשיו',
                    style: 'cancel',
                  },
                  {
                    text: 'עדכן',
                    onPress: async () => {
                      try {
                        await Updates.fetchUpdateAsync();
                        await Updates.reloadAsync();
                      } catch (error) {
                        console.error('Error applying update:', error);
                      }
                    },
                  },
                ]
              );
            }
          } else {
            console.log('ℹ️ No updates available');
          }
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    }

    // Check immediately on app start
    checkAndFetchUpdates();
    
    // Also check when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('🔄 App came to foreground, checking for updates...');
        checkAndFetchUpdates();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Process scheduled reminders every 5 minutes (only for admin users)
  useEffect(() => {
    const processReminders = async () => {
      try {
        // Check if user is admin before processing reminders
        const { getCurrentUser, checkIsAdmin, processScheduledReminders } = await import('../services/firebase');
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          return; // Not logged in, skip
        }
        
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
          return; // Not admin, skip - Cloud Functions will handle this
        }
        
        console.log('🕐 Processing scheduled reminders (admin)...');
        await processScheduledReminders();
        console.log('✅ Reminders processed successfully');
      } catch (error) {
        // Silently fail - this is expected for non-admin users
        // Cloud Functions will handle reminders processing
        if (error instanceof Error && error.message.includes('permission')) {
          console.log('ℹ️ Reminders processing skipped (not admin - Cloud Functions will handle)');
        } else {
          console.error('❌ Error processing reminders:', error);
        }
      }
    };

    // Process reminders immediately when app starts (if admin)
    processReminders();

    // Process reminders every 5 minutes (if admin)
    const interval = setInterval(processReminders, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't hide splash screen here - let splash.tsx handle it
  // This ensures smooth transition from native splash to expo splash

  if (!loaded) {
    // Show black screen while fonts are loading (matches splash screen)
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppAuthGate>
          <Stack>
            <Stack.Screen name="splash" options={{ headerShown: false }} />
            <Stack.Screen name="auth-choice" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="booking" options={{ headerShown: false }} />
            <Stack.Screen name="admin-home" options={{ headerShown: false }} />
            <Stack.Screen name="admin-appointments" options={{ headerShown: false }} />
            <Stack.Screen name="admin-availability" options={{ headerShown: false }} />
            <Stack.Screen name="admin-gallery" options={{ headerShown: false }} />
            <Stack.Screen name="admin-notification-settings" options={{ headerShown: false }} />
            <Stack.Screen name="admin-notifications" options={{ headerShown: false }} />
            <Stack.Screen name="admin-settings" options={{ headerShown: false }} />
            <Stack.Screen name="admin-statistics" options={{ headerShown: false }} />
            <Stack.Screen name="admin-team" options={{ headerShown: false }} />
            <Stack.Screen name="admin-treatments" options={{ headerShown: false }} />
            <Stack.Screen name="my-appointments" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" options={{ headerShown: false }} />
          </Stack>
        </AppAuthGate>
        <StatusBar style="auto" />
      </ThemeProvider>
    </I18nextProvider>
  );
}
