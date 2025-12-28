import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    clearAllUserNotifications,
    deleteOldNotifications,
    dismissBroadcastMessage,
    getActiveBroadcastMessages,
    getCurrentUser,
    getUserNotifications,
    markNotificationAsRead
} from '../../services/firebase';

const {} = Dimensions.get('window');

interface Notification {
  id: string;
  type: 'appointment' | 'general' | 'reminder' | 'broadcast';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  isBroadcast?: boolean; // Flag to identify broadcast messages
}

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Load notifications when panel opens
  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const user = getCurrentUser();
      if (user) {
        // Load user-specific notifications
        const userNotifications = await getUserNotifications(user.uid);

        // Load active broadcast messages (not dismissed by this user)
        const broadcastMessages = await getActiveBroadcastMessages(user.uid);

        // Convert broadcast messages to notification format
        const broadcastNotifications: Notification[] = broadcastMessages.map(msg => ({
          id: msg.id,
          type: 'broadcast' as const,
          title: msg.title,
          message: msg.body,
          time: msg.sentAt?.toDate?.()?.toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) || 'לא ידוע',
          isRead: false, // Broadcast messages are always "unread" until dismissed
          isBroadcast: true
        }));

        // Combine and sort by time (newest first)
        const allNotifications = [...broadcastNotifications, ...userNotifications];
        setNotifications(allNotifications);

        // Delete old notifications in background (don't wait for it) - 48 hours
        deleteOldNotifications(user.uid, 48).catch(err => {
          console.error('Error deleting old notifications:', err);
        });
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment':
        return 'calendar';
      case 'reminder':
        return 'alarm';
      case 'broadcast':
        return 'megaphone';
      case 'general':
        return 'notifications';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'appointment':
        return '#007bff';
      case 'reminder':
        return '#FF9800';
      case 'broadcast':
        return '#8B4513'; // Brown color for broadcast
      case 'general':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // If it's a broadcast message, show with dismiss option
    if (notification.isBroadcast) {
      Alert.alert(
        notification.title,
        notification.message,
        [
          { text: 'סגור', style: 'cancel' },
          {
            text: 'סמן כנקרא (לא להציג שוב)',
            style: 'default',
            onPress: async () => {
              const user = getCurrentUser();
              if (user) {
                await dismissBroadcastMessage(notification.id, user.uid);
                // Remove from list
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
              }
            }
          }
        ]
      );
    } else {
      // Mark regular notification as read
      if (!notification.isRead) {
        try {
          await markNotificationAsRead(notification.id);
          setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
          );
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      }

      Alert.alert(
        notification.title,
        notification.message,
        [{ text: 'סגור', style: 'default' }]
      );
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      for (const notification of unreadNotifications) {
        await markNotificationAsRead(notification.id);
      }
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      Alert.alert('התראות', 'כל ההתראות סומנו כנקראו');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'מחק התראות',
      'האם למחוק את כל ההתראות?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = getCurrentUser();
              if (user) {
                await clearAllUserNotifications(user.uid);
                setNotifications([]);
              }
            } catch (error) {
              console.error('Error clearing notifications:', error);
            }
          }
        }
      ]
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              התראות {unreadCount > 0 && `(${unreadCount})`}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.notificationsList}>
            {loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.emptyText}>טוען התראות...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off" size={48} color="#ccc" />
                <Text style={styles.emptyText}>אין התראות חדשות</Text>
              </View>
            ) : (
              notifications.map((notification) => (
                <View
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.isRead && styles.unreadNotification
                  ]}
                >
                  <TouchableOpacity
                    style={styles.notificationContent}
                    onPress={() => handleNotificationPress(notification)}
                  >
                    <View style={styles.notificationHeader}>
                      <View style={styles.notificationLeft}>
                        <Ionicons
                          name={getNotificationIcon(notification.type) as any}
                          size={20}
                          color={getNotificationColor(notification.type)}
                        />
                        <Text style={styles.notificationTitle}>
                          {notification.title}
                        </Text>
                      </View>
                      <Text style={styles.notificationTime}>
                        {notification.time}
                      </Text>
                    </View>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                  </TouchableOpacity>
                  {!notification.isRead && !notification.isBroadcast && (
                    <TouchableOpacity
                      style={styles.markReadButton}
                      onPress={async () => {
                        try {
                          await markNotificationAsRead(notification.id);
                          setNotifications(prev =>
                            prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
                          );
                        } catch (error) {
                          console.error('Error marking notification as read:', error);
                        }
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={24} color="#007bff" />
                    </TouchableOpacity>
                  )}
                  {!notification.isRead && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            {notifications.length > 0 && (
              <View style={styles.footerButtons}>
                <TouchableOpacity
                  style={styles.markAllReadButton}
                  onPress={handleMarkAllRead}
                >
                  <Text style={styles.markAllReadText}>סמן הכל כנקרא</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={handleClearAll}
                >
                  <Ionicons name="trash-outline" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    padding: 4,
  },
  notificationsList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  markReadButton: {
    marginLeft: 8,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadNotification: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginLeft: 8,
    textAlign: 'right',
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'right',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007bff',
    position: 'absolute',
    top: 12,
    right: 12,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllReadButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  markAllReadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearAllButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
});

export default NotificationPanel;
