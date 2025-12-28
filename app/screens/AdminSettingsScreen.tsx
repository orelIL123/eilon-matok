import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { cleanupOldAppointments, db } from '../../services/firebase';
import ToastMessage from '../components/ToastMessage';
import TopNav from '../components/TopNav';

interface AdminSettingsScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

const AdminSettingsScreen: React.FC<AdminSettingsScreenProps> = ({ onNavigate, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [cleanupLoading, setCleanupLoading] = useState(false);
  
  // Settings states
  const [welcomeMessage, setWelcomeMessage] = useState('שלום, ברוכים הבאים ל-eilon matok לאילון מתוק');
  const [subtitleMessage, setSubtitleMessage] = useState('לאילון מתוק ברברשופ');
  const [aboutUsText, setAboutUsText] = useState('ברוכים הבאים למספרת אילון מתוק!\n\nאנחנו מספרה משפחתית בבאר שבע, מתמחים בתספורות גברים, תספורות ילדים וטיפוח אישי.\n\nהצוות שלנו מנוסה ומקצועי, וכל לקוח מקבל יחס אישי ותשומת לב. אנחנו משתמשים במוצרים איכותיים ומקפידים על ניקיון והיגיינה.\n\nבואו להתרענן, להרגיש בבית ולצאת עם תספורת שתתאים לכם בדיוק.');

  useEffect(() => {
    loadSettings();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleCleanupAppointments = async () => {
    Alert.alert(
      'ניקוי תורים ישנים',
      'פעולה זו תמחק תורים ישנים מ-10 ימים ומעלה מהפיירבייס כדי להפחית עומס. התורים יופיעו עדיין בדשבורד. האם להמשיך?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'מחק', 
          style: 'destructive',
          onPress: async () => {
            try {
              setCleanupLoading(true);
              console.log('🧹 Starting appointment cleanup...');
              
              const result = await cleanupOldAppointments(10);
              
              if (result.errorCount === 0) {
                showToast(`ניקוי הושלם בהצלחה! נמחקו ${result.deletedCount} תורים ישנים`, 'success');
              } else {
                showToast(`ניקוי הושלם עם שגיאות. נמחקו ${result.deletedCount} תורים, ${result.errorCount} שגיאות`, 'error');
                console.error('Cleanup errors:', result.errors);
              }
            } catch (error) {
              console.error('Error during cleanup:', error);
              showToast('שגיאה במהלך הניקוי', 'error');
            } finally {
              setCleanupLoading(false);
            }
          }
        }
      ]
    );
  };

  const hideToast = () => {
    setToast({ ...toast, visible: false });
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load welcome messages
      const welcomeDoc = await getDoc(doc(db, 'settings', 'homeMessages'));
      if (welcomeDoc.exists()) {
        const data = welcomeDoc.data();
        setWelcomeMessage(data.welcome || 'שלום, ברוכים הבאים ל-eilon matok לאילון מתוק');
        setSubtitleMessage(data.subtitle || 'לאילון מתוק ברברשופ');
      } else {
        // Create default if doesn't exist
        await setDoc(
          doc(db, 'settings', 'homeMessages'),
          {
            welcome: 'שלום, ברוכים הבאים ל-eilon matok לאילון מתוק',
            subtitle: 'לאילון מתוק ברברשופ',
            createdAt: new Date()
          },
          { merge: true }
        );
      }

      // Load about us text
      const aboutDoc = await getDoc(doc(db, 'settings', 'aboutUsText'));
      if (aboutDoc.exists()) {
        const data = aboutDoc.data();
        setAboutUsText(data.text || '');
      } else {
        // Create default if doesn't exist
        const defaultAboutText = 'ברוכים הבאים למספרת אילון מתוק!\n\nאנחנו מספרה משפחתית בבאר שבע, מתמחים בתספורות גברים, תספורות ילדים וטיפוח אישי.\n\nהצוות שלנו מנוסה ומקצועי, וכל לקוח מקבל יחס אישי ותשומת לב. אנחנו משתמשים במוצרים איכותיים ומקפידים על ניקיון והיגיינה.\n\nבואו להתרענן, להרגיש בבית ולצאת עם תספורת שתתאים לכם בדיוק.';
        await setDoc(
          doc(db, 'settings', 'aboutUsText'),
          {
            text: defaultAboutText,
            createdAt: new Date()
          },
          { merge: true }
        );
        setAboutUsText(defaultAboutText);
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('שגיאה בטעינת ההגדרות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveWelcomeMessages = async () => {
    try {
      setLoading(true);
      await setDoc(
        doc(db, 'settings', 'homeMessages'),
        {
          welcome: welcomeMessage,
          subtitle: subtitleMessage,
          updatedAt: new Date()
        },
        { merge: true }
      );
      showToast('הודעות הברכה עודכנו בהצלחה!');
    } catch (error) {
      console.error('Error saving welcome messages:', error);
      showToast('שגיאה בשמירת ההודעות', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveAboutUsText = async () => {
    try {
      setLoading(true);
      await setDoc(
        doc(db, 'settings', 'aboutUsText'),
        {
          text: aboutUsText,
          updatedAt: new Date()
        },
        { merge: true }
      );
      showToast('טקסט אודותינו עודכן בהצלחה!');
    } catch (error) {
      console.error('Error saving about us text:', error);
      showToast('שגיאה בשמירת הטקסט', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title="הגדרות מנהל" 
        onBellPress={() => {}} 
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('admin-home'))}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Welcome Messages Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>הודעות ברכה בעמוד הבית</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>הודעת ברכה ראשית</Text>
            <TextInput
              style={styles.textInput}
              value={welcomeMessage}
              onChangeText={setWelcomeMessage}
              placeholder="שלום, ברוכים הבאים ל-eilon matok לאילון מתוק"
              textAlign="right"
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>כותרת משנה</Text>
            <TextInput
              style={styles.textInput}
              value={subtitleMessage}
              onChangeText={setSubtitleMessage}
              placeholder="לאילון מתוק ברברשופ"
              textAlign="right"
              multiline
            />
          </View>

          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={saveWelcomeMessages}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>שמור הודעות ברכה</Text>
          </TouchableOpacity>
        </View>

        {/* About Us Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>טקסט אודותינו</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>תוכן הטקסט</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={aboutUsText}
              onChangeText={setAboutUsText}
              placeholder="טקסט אודותינו..."
              textAlign="right"
              multiline
              numberOfLines={8}
            />
          </View>

          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={saveAboutUsText}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>שמור טקסט אודותינו</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>הגדרות התראות</Text>
          <Text style={styles.sectionDescription}>
            נהל איזה התראות ברצונך לקבל
          </Text>
          
          <TouchableOpacity 
            style={styles.notificationButton} 
            onPress={() => {
              // Use Expo Router for navigation
              const { router } = require('expo-router');
              router.push('/admin-notification-settings');
            }}
          >
            <Ionicons name="notifications" size={24} color="#007bff" />
            <Text style={styles.notificationButtonText}>הגדרות התראות</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Cleanup Section - Small */}
        <View style={styles.cleanupSection}>
          <TouchableOpacity 
            style={[styles.cleanupButton, cleanupLoading && styles.cleanupButtonDisabled]} 
            onPress={handleCleanupAppointments}
            disabled={cleanupLoading}
          >
            <Ionicons name="trash" size={16} color="#fff" />
            <Text style={styles.cleanupButtonText}>
              {cleanupLoading ? 'מנקה...' : 'נקה תורים ישנים'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'right',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'right',
    lineHeight: 20,
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
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sendButton: {
    backgroundColor: '#007bff',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#dc3545',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  notificationButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    textAlign: 'right',
  },
  // Cleanup styles
  cleanupSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cleanupButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  cleanupButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  cleanupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AdminSettingsScreen;