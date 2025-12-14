import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import 'nativewind';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Alert, View } from 'react-native';
import 'react-native-reanimated';
import '../app/globals.css';
import { auth } from '../config/firebase';
import { processScheduledReminders } from '../services/firebase';
import { ensureAndroidChannel } from '../services/notifications';
import AppAuthGate from './components/AppAuthGate';
import i18n from './i18n';

import { useColorScheme } from '../hooks/useColorScheme';

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

  // Check for updates on app start
  useEffect(() => {
    async function checkForUpdates() {
      try {
        // Only check for updates in production
        if (!__DEV__) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
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
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  },
                },
              ]
            );
          }
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    }

    checkForUpdates();
  }, []);

  // Process scheduled reminders every 5 minutes
  useEffect(() => {
    const processReminders = async () => {
      try {
        console.log('🕐 Processing scheduled reminders...');
        await processScheduledReminders();
        console.log('✅ Reminders processed successfully');
      } catch (error) {
        console.error('❌ Error processing reminders:', error);
      }
    };

    // Process reminders immediately when app starts
    processReminders();

    // Process reminders every 5 minutes
    const interval = setInterval(processReminders, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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
