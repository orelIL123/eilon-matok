import { Feather, Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {
    checkIsAdmin,
    getAllUsers,
    onAuthStateChange,
    getBroadcastMessages,
    deleteBroadcastMessage,
    BroadcastMessage
} from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import TopNav from '../components/TopNav';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

interface AdminNotificationsScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

interface UserProfile {
  uid: string;
  displayName: string;
  phone: string;
  expoPushToken?: string;
  pushToken?: string; // legacy
  isAdmin?: boolean;
}

const AdminNotificationsScreen: React.FC<AdminNotificationsScreenProps> = ({ onNavigate, onBack }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        const adminStatus = await checkIsAdmin(user.uid);
        setIsAdmin(adminStatus);
        if (!adminStatus) {
          onNavigate('home');
        }
      } else {
        onNavigate('home');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadBroadcastMessages();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBroadcastMessages = async () => {
    try {
      setLoadingMessages(true);
      const messages = await getBroadcastMessages();
      setBroadcastMessages(messages);
      console.log('✅ Loaded broadcast messages:', messages.length);
    } catch (error) {
      console.error('❌ Error loading broadcast messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      'מחיקת הודעה',
      'האם אתה בטוח שברצונך למחוק הודעה זו? פעולה זו לא תחזור.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteBroadcastMessage(messageId);
              if (success) {
                Alert.alert('הצלחה', 'ההודעה נמחקה בהצלחה');
                loadBroadcastMessages(); // Reload messages
              } else {
                Alert.alert('שגיאה', 'לא ניתן למחוק את ההודעה');
              }
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('שגיאה', 'אירעה שגיאה בעת מחיקת ההודעה');
            }
          }
        }
      ]
    );
  };

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationBody.trim()) {
      Alert.alert('שגיאה', 'נא למלא את כותרת ההודעה ותוכן ההודעה');
      return;
    }

    try {
      // Import notification functions
      const { sendNotificationToAllUsers, sendNotificationToUser } = await import('../../services/firebase');
      
      let success = false;
      
      if (selectedUser === 'all') {
        // Use the fixed function that filters out admins
        const sentCount = await sendNotificationToAllUsers(notificationTitle, notificationBody);
        success = sentCount > 0;
      } else {
        success = await sendNotificationToUser(selectedUser, notificationTitle, notificationBody);
      }
      
      if (success) {
        // Reload broadcast messages after sending
        loadBroadcastMessages();
        Alert.alert(
          'התראה נשלחה',
          'ההודעה "' + notificationTitle + '" נשלחה בהצלחה!',
          [
            {
              text: 'אישור',
              onPress: () => {
                setModalVisible(false);
                setNotificationTitle('');
                setNotificationBody('');
                setSelectedUser('all');
              }
            }
          ]
        );
      } else {
        Alert.alert('שגיאה', 'לא ניתן לשלוח את ההודעה - בדוק שהמשתמשים רשומים להתראות');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('שגיאה', 'לא ניתן לשלוח את ההודעה');
    }
  };

  const getUsersWithTokens = () => {
    return users.filter(user => user.expoPushToken || user.pushToken);
  };

  const getUsersWithoutTokens = () => {
    return users.filter(user => !(user.expoPushToken || user.pushToken));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ScissorsLoader />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#dc3545" />
          <Text style={styles.errorText}>אין לך הרשאות מנהל</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('home')}>
            <Text style={styles.backButtonText}>חזור לעמוד הבית</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title="ניהול התראות"
        onBellPress={() => {}}
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('admin-home'))}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={32}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <LinearGradient
                  colors={[colors.barberGold, colors.barberGoldDark]}
                  style={styles.headerGradient}
                >
                  <Text style={styles.headerTitle}>שליחת התראות</Text>
                  <Text style={styles.headerSubtitle}>שלח הודעות למשתמשי האפליקציה</Text>
                </LinearGradient>
              </View>

              {/* Statistics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>סטטיסטיקות משתמשים</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Ionicons name="people" size={24} color="#007bff" />
                    <Text style={styles.statValue}>{users.length}</Text>
                    <Text style={styles.statLabel}>סה&quot;כ משתמשים</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="notifications" size={24} color="#28a745" />
                    <Text style={styles.statValue}>{getUsersWithTokens().length}</Text>
                    <Text style={styles.statLabel}>עם התראות</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="close-circle" size={24} color="#dc3545" />
                    <Text style={styles.statValue}>{getUsersWithoutTokens().length}</Text>
                    <Text style={styles.statLabel}>ללא התראות</Text>
                  </View>
                </View>
              </View>

              {/* Broadcast Messages History */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>הודעות שנשלחו</Text>
                  {loadingMessages && (
                    <Text style={styles.loadingText}>טוען...</Text>
                  )}
                </View>
                {broadcastMessages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="mail-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyStateText}>אין הודעות שנשלחו עדיין</Text>
                  </View>
                ) : (
                  broadcastMessages.map((message) => {
                    const sentDate = message.sentAt?.toDate ? message.sentAt.toDate() : new Date(message.sentAt);
                    const dateStr = sentDate.toLocaleDateString('he-IL', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <View key={message.id} style={styles.messageCard}>
                        <View style={styles.messageHeader}>
                          <View style={styles.messageInfo}>
                            <Text style={styles.messageTitle}>{message.title}</Text>
                            <Text style={styles.messageDate}>{dateStr}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteMessage(message.id)}
                          >
                            <Ionicons name="trash-outline" size={20} color="#dc3545" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.messageBody}>{message.body}</Text>
                        <View style={styles.messageFooter}>
                          <Text style={styles.messageMeta}>
                            נשלח על ידי: {message.sentByName}
                          </Text>
                          <Text style={styles.messageMeta}>
                            נשלח ל-{message.recipientCount} משתמשים
                          </Text>
                          {message.includesSMS && (
                            <Text style={styles.smsBadge}>SMS</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Users List */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>רשימת משתמשים</Text>
                {users.map((user) => (
                  <View key={user.uid} style={styles.userCard}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.displayName}</Text>
                      <Text style={styles.userPhone}>{user.phone}</Text>
                    </View>
                    <View style={styles.userStatus}>
                      {(user.expoPushToken || user.pushToken) ? (
                        <Ionicons name="notifications" size={20} color="#28a745" />
                      ) : (
                        <Ionicons name="notifications-off" size={20} color="#dc3545" />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          {/* Send Button always visible at bottom */}
          <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' }}>
            <TouchableOpacity style={styles.sendButton} onPress={() => setModalVisible(true)}>
              <Feather name="send" size={24} color="#fff" />
              <Text style={styles.sendButtonText}>שלח הודעה חדשה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Send Notification Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>שלח הודעה חדשה</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>כותרת ההודעה *</Text>
                <TextInput
                  style={styles.textInput}
                  value={notificationTitle}
                  onChangeText={setNotificationTitle}
                  placeholder="לדוגמה: תור חדש זמין"
                  textAlign="right"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>תוכן ההודעה *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notificationBody}
                  onChangeText={setNotificationBody}
                  placeholder="תוכן ההודעה..."
                  multiline
                  numberOfLines={4}
                  textAlign="right"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>שלח ל:</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={[styles.radioButton, selectedUser === 'all' && styles.radioButtonSelected]}
                    onPress={() => setSelectedUser('all')}
                  >
                    <Ionicons 
                      name={selectedUser === 'all' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={selectedUser === 'all' ? '#007bff' : '#666'} 
                    />
                    <Text style={styles.radioLabel}>כל המשתמשים ({users.length})</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.radioButton, selectedUser === 'with-tokens' && styles.radioButtonSelected]}
                    onPress={() => setSelectedUser('with-tokens')}
                  >
                    <Ionicons 
                      name={selectedUser === 'with-tokens' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={selectedUser === 'with-tokens' ? '#007bff' : '#666'} 
                    />
                    <Text style={styles.radioLabel}>עם התראות ({getUsersWithTokens().length})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.sendButton]}
                onPress={sendNotification}
              >
                <Text style={styles.sendButtonText}>שלח הודעה</Text>
              </TouchableOpacity>
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 100,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerGradient: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e9ecef',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: '#6c757d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    textAlign: 'right',
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  userStatus: {
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  modalBody: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'right',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  radioGroup: {
    gap: 12,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButtonSelected: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  messageInfo: {
    flex: 1,
    marginRight: 12,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'right',
  },
  messageDate: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  messageBody: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'right',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  messageMeta: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  smsBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#28a745',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default AdminNotificationsScreen; 