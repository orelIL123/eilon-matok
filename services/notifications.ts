/**
 * Notifications Service
 *
 * Handles all notification-related functionality:
 * - Permission requests (iOS/Android)
 * - Push token registration/revocation
 * - Local notification scheduling (appointment reminders)
 * - Notification channel setup (Android)
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// ============================================================================
// TYPES
// ============================================================================

export type ReminderKind = 'T_MINUS_24H' | 'T_MINUS_1H' | 'AT_TIME';

export interface ReminderSpec {
  id: string;                 // deterministic ID for cancel/update
  when: Date;                 // absolute time
  title: string;
  body: string;
  data?: Record<string, any>; // include appointmentId, barberId, etc.
}

export interface AppointmentReminderData {
  id: string;
  startsAt: string; // ISO string
  barberName?: string;
  shopName?: string;
  treatmentName?: string;
}

// ============================================================================
// PERMISSION HANDLING
// ============================================================================

/**
 * Request and ensure notification permissions are granted
 * Handles both iOS and Android permission flows
 * @returns true if granted, false otherwise
 */
export async function ensurePermissions(): Promise<boolean> {
  try {
    console.log('📱 Requesting notification permissions...');

    // Check if we're on a real device (notifications don't work on simulator)
    if (!Device.isDevice) {
      console.log('⚠️ Must use physical device for Push Notifications');
      return false;
    }

    // Get current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not determined, ask the user
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions denied');
      return false;
    }

    console.log('✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting permissions:', error);
    return false;
  }
}

/**
 * Check if notification permissions are currently granted
 * @returns true if granted, false otherwise
 */
export async function checkPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('❌ Error checking permissions:', error);
    return false;
  }
}

// ============================================================================
// ANDROID CHANNEL SETUP
// ============================================================================

/**
 * Create Android notification channel with HIGH importance
 * Required for notifications to show on Android 8.0+
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ברירת מחדל',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8b4513',
        sound: 'default',
        enableVibrate: true,
      });

      // Create a high-priority channel specifically for appointment reminders
      await Notifications.setNotificationChannelAsync('appointment-reminders', {
        name: 'תזכורות תורים',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8b4513',
        sound: 'default',
        enableVibrate: true,
      });

      console.log('✅ Android notification channels created');
    } catch (error) {
      console.error('❌ Error creating Android channels:', error);
    }
  }
}

// ============================================================================
// PUSH TOKEN MANAGEMENT
// ============================================================================

/**
 * Register push token for a user
 * Saves the Expo push token to Firestore for server-side push notifications
 * Only registers if permissions are already granted (does not request permissions)
 * @param uid - Firebase user ID
 */
export async function registerPushTokenForUser(uid: string): Promise<void> {
  try {
    console.log('🔄 Registering push token for user:', uid);

    // Check if permissions are already granted (don't request)
    const hasPermission = await checkPermissions();
    if (!hasPermission) {
      console.log('❌ Cannot register push token without permissions - user must enable notifications first');
      return;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '229bec8c-f551-41b7-8e6b-e8e26fb31945',
    });
    const token = tokenData.data;

    console.log('📱 Push token obtained:', token);

    // Save to Firestore
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
    });

    console.log('✅ Push token registered successfully');
  } catch (error) {
    console.error('❌ Error registering push token:', error);
    // Don't throw - registration can fail silently without breaking the app
  }
}

/**
 * Revoke push token for a user
 * Removes the Expo push token from Firestore (called on logout)
 * @param uid - Firebase user ID
 */
export async function revokePushTokenForUser(uid: string): Promise<void> {
  try {
    console.log('🔄 Revoking push token for user:', uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      expoPushToken: deleteField(),
      pushTokenUpdatedAt: deleteField(),
    });

    console.log('✅ Push token revoked successfully');
  } catch (error) {
    console.error('❌ Error revoking push token:', error);
    // Don't throw - allow logout to continue even if token revocation fails
  }
}

// ============================================================================
// LOCAL NOTIFICATION SCHEDULING
// ============================================================================

/**
 * Schedule a single absolute-time local notification
 * @param spec - Notification specification
 * @returns Notification identifier for cancellation
 */
export async function scheduleAbsolute(spec: ReminderSpec): Promise<string> {
  try {
    // Ensure Android channel exists
    await ensureAndroidChannel();

    // Ensure the trigger time is in the future
    if (spec.when.getTime() <= Date.now()) {
      console.log('⚠️ Cannot schedule notification in the past:', spec.id);
      throw new Error('Cannot schedule notification in the past');
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: spec.id, // Use deterministic ID
      content: {
        title: spec.title,
        body: spec.body,
        data: spec.data || {},
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // Use high-priority channel for Android
        ...(Platform.OS === 'android' && {
          channelId: 'appointment-reminders',
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: spec.when,
      } as Notifications.DateTriggerInput,
    });

    console.log('✅ Scheduled notification:', spec.id, 'at', spec.when.toLocaleString('he-IL'));
    return notificationId;
  } catch (error) {
    console.error('❌ Error scheduling notification:', spec.id, error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification by ID
 * @param id - Notification identifier
 */
export async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    console.log('✅ Cancelled notification:', id);
  } catch (error) {
    console.error('❌ Error cancelling notification:', id, error);
    // Don't throw - cancellation can fail silently if notification doesn't exist
  }
}

/**
 * Cancel all scheduled local notifications
 * Called on logout to prevent notifications after user signs out
 */
export async function cancelAllLocal(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All local notifications cancelled');
  } catch (error) {
    console.error('❌ Error cancelling all notifications:', error);
  }
}

/**
 * Dismiss all presented notifications
 * Clears notifications from the notification tray
 */
export async function dismissAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    console.log('✅ All notifications dismissed');
  } catch (error) {
    console.error('❌ Error dismissing notifications:', error);
  }
}

/**
 * Get all currently scheduled notifications
 * Useful for debugging
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('📋 Scheduled notifications:', notifications.length);
    return notifications;
  } catch (error) {
    console.error('❌ Error getting scheduled notifications:', error);
    return [];
  }
}

// ============================================================================
// APPOINTMENT REMINDER SCHEDULING
// ============================================================================

/**
 * Schedule all reminders for an appointment (T-24h, T-1h, T-0)
 * Respects admin settings for which reminders to send to customers
 * @param appointment - Appointment data
 */
export async function scheduleAppointmentReminders(appointment: AppointmentReminderData): Promise<void> {
  try {
    console.log('📅 Scheduling appointment reminders for:', appointment.id);

    const appointmentTime = new Date(appointment.startsAt);
    const now = new Date();

    // Log detailed timing information for debugging
    console.log('📅 Appointment time (ISO):', appointment.startsAt);
    console.log('📅 Appointment time (parsed):', appointmentTime.toISOString());
    console.log('📅 Appointment time (local):', appointmentTime.toLocaleString('he-IL'));
    console.log('📅 Current time (local):', now.toLocaleString('he-IL'));
    console.log('📅 Time difference (ms):', appointmentTime.getTime() - now.getTime());
    console.log('📅 Time difference (hours):', (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60));

    // Validate appointment is in the future
    if (appointmentTime.getTime() <= now.getTime()) {
      console.log('⚠️ Appointment is in the past, not scheduling reminders');
      return;
    }

    // Get admin settings to check which customer reminders are enabled
    let adminSettings;
    try {
      // Dynamically import to avoid circular dependency
      const { getAdminNotificationSettings } = await import('./firebase');
      adminSettings = await getAdminNotificationSettings();
      console.log('🔧 Admin customer reminder settings:', adminSettings.customerReminderSettings);
    } catch (error) {
      console.error('❌ Error getting admin settings, using defaults:', error);
      // Default to all enabled if we can't get settings
      adminSettings = {
        customerReminderSettings: {
          enabled: true,
          t24hEnabled: true,
          t1hEnabled: true,
          t0Enabled: true,
        },
      };
    }

    // Check if customer reminders are globally disabled
    if (adminSettings.customerReminderSettings && !adminSettings.customerReminderSettings.enabled) {
      console.log('🔕 Customer reminders are disabled by admin');
      return;
    }

    // Calculate reminder times
    const t24h = new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000);
    const t1h = new Date(appointmentTime.getTime() - 1 * 60 * 60 * 1000);
    const tAt = appointmentTime;

    // Build reminder specifications based on admin settings
    const specs: ReminderSpec[] = [];

    // T-24h reminder (if enabled by admin)
    if (adminSettings.customerReminderSettings?.t24hEnabled !== false) {
      specs.push({
        id: `${appointment.id}:T_MINUS_24H`,
        when: t24h,
        title: '💈 תזכורת לתור',
        body: `התור שלך מחר ב-${appointmentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
        data: {
          appointmentId: appointment.id,
          kind: 'T_MINUS_24H',
          type: 'appointment-reminder',
        },
      });
    } else {
      console.log('🔕 T-24h reminder disabled by admin');
    }

    // T-1h reminder (if enabled by admin)
    if (adminSettings.customerReminderSettings?.t1hEnabled !== false) {
      specs.push({
        id: `${appointment.id}:T_MINUS_1H`,
        when: t1h,
        title: '💈 תזכורת לתור',
        body: `התור שלך בעוד שעה ב-${appointmentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
        data: {
          appointmentId: appointment.id,
          kind: 'T_MINUS_1H',
          type: 'appointment-reminder',
        },
      });
    } else {
      console.log('🔕 T-1h reminder disabled by admin');
    }

    // T-0 (at time) reminder (if enabled by admin)
    if (adminSettings.customerReminderSettings?.t0Enabled !== false) {
      specs.push({
        id: `${appointment.id}:AT_TIME`,
        when: tAt,
        title: '💈 התור שלך מתחיל!',
        body: `התור שלך מתחיל עכשיו`,
        data: {
          appointmentId: appointment.id,
          kind: 'AT_TIME',
          type: 'appointment-reminder',
        },
      });
    } else {
      console.log('🔕 T-0 reminder disabled by admin');
    }

    // Filter out past triggers AND triggers more than 24 hours away
    // (cloud scheduler will handle those via scheduledReminders collection)
    const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const validSpecs = specs.filter((s) => {
      const isPast = s.when.getTime() <= now.getTime();
      if (isPast) return false;

      // Don't schedule local notifications for appointments more than 24 hours away
      if (hoursUntilAppointment > 24) {
        console.log(`🔕 Skipping reminder ${s.data?.kind} - appointment is ${hoursUntilAppointment.toFixed(1)} hours away (>24h)`);
        return false;
      }

      return true;
    });

    console.log(`📅 Scheduling ${validSpecs.length} reminders (${specs.length - validSpecs.length} skipped: past or too far)`);

    // Schedule each reminder
    for (const spec of validSpecs) {
      try {
        await scheduleAbsolute(spec);
      } catch (error) {
        console.error('❌ Failed to schedule reminder:', spec.id, error);
        // Continue with other reminders even if one fails
      }
    }

    console.log('✅ Appointment reminders scheduled successfully');
  } catch (error) {
    console.error('❌ Error scheduling appointment reminders:', error);
    // Don't throw - allow appointment creation to succeed even if reminders fail
  }
}

/**
 * Cancel all reminders for a specific appointment
 * Called when appointment is cancelled or rescheduled
 * @param appointmentId - Appointment ID
 */
export async function cancelAppointmentReminders(appointmentId: string): Promise<void> {
  try {
    console.log('🔄 Cancelling reminders for appointment:', appointmentId);

    const kinds: ReminderKind[] = ['T_MINUS_24H', 'T_MINUS_1H', 'AT_TIME'];

    for (const kind of kinds) {
      const id = `${appointmentId}:${kind}`;
      await cancelById(id);
    }

    console.log('✅ Appointment reminders cancelled');
  } catch (error) {
    console.error('❌ Error cancelling appointment reminders:', error);
  }
}

/**
 * Reschedule appointment reminders
 * Cancels old reminders and schedules new ones
 * @param appointment - Updated appointment data
 */
export async function rescheduleAppointmentReminders(appointment: AppointmentReminderData): Promise<void> {
  try {
    console.log('🔄 Rescheduling reminders for appointment:', appointment.id);

    // Cancel old reminders
    await cancelAppointmentReminders(appointment.id);

    // Schedule new reminders
    await scheduleAppointmentReminders(appointment);

    console.log('✅ Appointment reminders rescheduled');
  } catch (error) {
    console.error('❌ Error rescheduling appointment reminders:', error);
  }
}

// ============================================================================
// CLEANUP ON LOGOUT
// ============================================================================

/**
 * Complete cleanup of all notification-related data
 * Called on logout to ensure no notifications are shown after sign-out
 * @param uid - Firebase user ID
 */
export async function cleanupNotificationsOnLogout(uid: string): Promise<void> {
  try {
    console.log('🧹 Cleaning up notifications on logout...');

    // 1. Revoke push token from Firestore
    await revokePushTokenForUser(uid);

    // 2. Cancel all scheduled local notifications
    await cancelAllLocal();

    // 3. Dismiss all presented notifications
    await dismissAllNotifications();

    console.log('✅ Notification cleanup complete');
  } catch (error) {
    console.error('❌ Error during notification cleanup:', error);
    // Don't throw - allow logout to continue
  }
}
