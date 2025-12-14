import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { checkIsAdmin, initializeCollections, initializeGalleryImages, listAllStorageImages, makeCurrentUserAdmin, onAuthStateChange, replaceGalleryPlaceholders, resetGalleryWithRealImages, restoreGalleryFromStorage } from '../../services/firebase';
import ScissorsLoader from '../components/ScissorsLoader';
import ToastMessage from '../components/ToastMessage';
import TopNav from '../components/TopNav';

const { width } = Dimensions.get('window');

interface AdminHomeScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

const AdminHomeScreen: React.FC<AdminHomeScreenProps> = ({ onNavigate, onBack }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [aboutUsText, setAboutUsText] = useState('');
  const [aboutUsLoading, setAboutUsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const adminStatus = await checkIsAdmin(user.uid);
        setIsAdmin(adminStatus);
        if (!adminStatus) {
          setToast({
            visible: true,
            message: `אין לך הרשאות מנהל (UID: ${user.uid})`,
            type: 'error'
          });
          // Give user more time to see the UID and debug
          setTimeout(() => onNavigate('home'), 5000);
        }
      } else {
        onNavigate('home');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // טען טקסט אודות מה-DB
  useEffect(() => {
    const fetchAboutUs = async () => {
      try {
        const db = getFirestore();
        const docRef = doc(db, 'settings', 'aboutUsText');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setAboutUsText(snap.data().text || '');
        } else {
          const defaultText = 'ברוכים הבאים למספרת אילון מתוק! כאן תיהנו מחוויה אישית, מקצועית ומפנקת, עם יחס חם לכל לקוח.';
          setAboutUsText(defaultText);
          await setDoc(docRef, { text: defaultText }, { merge: true });
        }
      } catch (e) {
        showToast('שגיאה בטעינת אודות', 'error');
      } finally {
        setAboutUsLoading(false);
      }
    };
    fetchAboutUs();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ ...toast, visible: false });
  };

  const handleInitializeGallery = async () => {
    try {
      showToast('מאתחל גלריה...', 'success');
      await initializeGalleryImages();
      showToast('הגלריה אותחלה בהצלחה!', 'success');
    } catch (error) {
      console.error('Error initializing gallery:', error);
      showToast('שגיאה באתחול הגלריה', 'error');
    }
  };

  const handleReplaceGallery = async () => {
    try {
      showToast('מחליף תמונות...', 'success');
      await replaceGalleryPlaceholders();
      showToast('התמונות הוחלפו בהצלחה!', 'success');
    } catch (error) {
      console.error('Error replacing gallery:', error);
      showToast('שגיאה בהחלפת התמונות', 'error');
    }
  };

  const handleResetGallery = async () => {
    try {
      showToast('מאפס גלריה...', 'success');
      await resetGalleryWithRealImages();
      showToast('הגלריה אופסה והתמונות החדשות נוספו!', 'success');
    } catch (error) {
      console.error('Error resetting gallery:', error);
      showToast('שגיאה באיפוס הגלריה', 'error');
    }
  };

  const handleListStorage = async () => {
    try {
      showToast('בודק תמונות ב-Firebase Storage...', 'success');
      await listAllStorageImages();
      showToast('בדוק את הקונסול לראות את התמונות!', 'success');
    } catch (error) {
      console.error('Error listing storage:', error);
      showToast('שגיאה בבדיקת Storage', 'error');
    }
  };

  const handleRestoreFromStorage = async () => {
    try {
      showToast('משחזר תמונות מ-Firebase Storage...', 'success');
      const count = await restoreGalleryFromStorage();
      showToast(`שוחזרו ${count} תמונות מ-Storage!`, 'success');
    } catch (error) {
      console.error('Error restoring from storage:', error);
      showToast('שגיאה בשחזור מ-Storage', 'error');
    }
  };

  const handleSaveAboutUs = async () => {
    setAboutUsLoading(true);
    try {
      const db = getFirestore();
      await setDoc(
        doc(db, 'settings', 'aboutUsText'),
        { text: aboutUsText, updatedAt: new Date() },
        { merge: true }
      );
      showToast('הטקסט נשמר בהצלחה!');
    } catch (e) {
      showToast('שגיאה בשמירת הטקסט', 'error');
    } finally {
      setAboutUsLoading(false);
    }
  };

  const adminMenuItems = [
    {
      title: 'ניהול תורים',
      subtitle: 'צפה וערוך תורים קיימים',
      icon: 'calendar',
      screen: 'admin-appointments',
      color: '#007bff'
    },
    {
      title: 'ניהול טיפולים ומחירים',
      subtitle: 'הוסף, ערוך ומחק טיפולים',
      icon: 'cut',
      screen: 'admin-treatments',
      color: '#28a745'
    },
    {
      title: 'ניהול הצוות',
      subtitle: 'הוסף ספרים וערוך פרופילים',
      icon: 'people',
      screen: 'admin-team',
      color: '#8B4513'
    },
    {
      title: 'ניהול הגלריה',
      subtitle: 'העלה תמונות וערוך תמונות רקע',
      icon: 'images',
      screen: 'admin-gallery',
      color: '#dc3545'
    },
    {
      title: 'הגדרות זמינות',
      subtitle: 'הגדר שעות פעילות לספרים',
      icon: 'time',
      screen: 'admin-availability',
      color: '#6f42c1'
    },
    {
      title: 'סטטיסטיקות עסק',
      subtitle: 'דשבורד הכנסות, לקוחות וטיפולים',
      icon: 'analytics',
      screen: 'admin-statistics',
      color: '#17a2b8'
    },
    {
      title: 'ניהול התראות',
      subtitle: 'שלח הודעות למשתמשים',
      icon: 'notifications',
      screen: 'admin-notifications',
      color: '#6c757d'
    },
    {
      title: 'הגדרות התראות',
      subtitle: 'הגדר איזה התראות לקבל כמנהל',
      icon: 'settings-outline',
      screen: 'admin-notification-settings',
      color: '#9c27b0'
    },
    {
      title: 'רשימת לקוחות',
      subtitle: 'צפה בכל הלקוחות, התקשר או שלח התראות',
      icon: 'people',
      screen: 'admin-customers',
      color: '#17a2b8'
    },
    {
      title: 'רשימת המתנה',
      subtitle: 'צפה ברשימת המתנה ל-7 ימים הקרובים',
      icon: 'list',
      screen: 'admin-waitlist',
      color: '#ff6b6b'
    },
    {
      title: 'הגדרות מנהל',
      subtitle: 'עריכת הודעות ברכה, טקסטים ושליחת הודעות',
      icon: 'settings',
      screen: 'admin-settings',
      color: '#fd7e14'
    },
    {
      title: 'צפה כלקוח',
      subtitle: 'צפה באפליקציה כמשתמש רגיל',
      icon: 'eye',
      screen: 'home',
      color: '#fd7e14'
    }
  ];

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
          <Text style={styles.debugText}>UID: {currentUserId}</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: '#28a745', marginBottom: 12 }]} 
            onPress={async () => {
              try {
                await makeCurrentUserAdmin();
                showToast('נוצרו הרשאות מנהל! רענן את האפליקציה', 'success');
                // Force refresh by reloading the component
                setTimeout(() => {
                  onNavigate('admin-home');
                }, 1000);
              } catch (error) {
                showToast('שגיאה ביצירת הרשאות מנהל', 'error');
              }
            }}
          >
            <Text style={styles.backButtonText}>הפוך אותי למנהל (DEBUG)</Text>
          </TouchableOpacity>
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
        title="פאנל מנהל"
        onBellPress={() => {}}
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => {})}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Welcome Header */}
          <View style={styles.welcomeSection}>
            <LinearGradient
              colors={['#000000', '#333333']}
              style={styles.welcomeGradient}
            >
              <Text style={styles.welcomeTitle}>ברוך הבא למנהל המערכת</Text>
              <Text style={styles.welcomeSubtitle}>נהל את הברברשופ שלך בקלות</Text>
            </LinearGradient>
          </View>

          {/* System Status */}
          <View style={styles.systemSection}>
            <Text style={styles.systemTitle}>מצב המערכת</Text>
            <View style={styles.systemItem}>
              <View style={styles.systemInfo}>
                <Text style={styles.systemLabel}>Firestore Database</Text>
                <Text style={styles.systemStatus}>פעיל</Text>
              </View>
              <View style={[styles.statusIndicator, styles.statusActive]} />
            </View>
            
            <TouchableOpacity 
              style={styles.initButton}
              onPress={handleInitializeGallery}
            >
              <Ionicons name="images" size={20} color="#fff" />
              <Text style={styles.initButtonText}>אתחל גלריה עם תמונות דמה</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.initButton, { backgroundColor: '#dc3545', marginTop: 12 }]}
              onPress={handleReplaceGallery}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.initButtonText}>החלף תמונות אפורות בתמונות אמיתיות</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.initButton, { backgroundColor: '#28a745', marginTop: 12 }]}
              onPress={handleResetGallery}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.initButtonText}>מחק הכל וצור גלריה חדשה</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.initButton, { backgroundColor: '#6f42c1', marginTop: 12 }]}
              onPress={handleListStorage}
            >
              <Ionicons name="folder" size={20} color="#fff" />
              <Text style={styles.initButtonText}>בדוק מה יש ב-Firebase Storage</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.initButton, { backgroundColor: '#fd7e14', marginTop: 12 }]}
              onPress={handleRestoreFromStorage}
            >
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.initButtonText}>שחזר התמונות שלי מ-Storage</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.initButton, { backgroundColor: '#9c27b0', marginTop: 12 }]}
              onPress={() => onNavigate('admin-notification-settings')}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <Text style={styles.initButtonText}>הגדרות התראות מנהל</Text>
            </TouchableOpacity>
          </View>

          {/* עריכת טקסט הכירו אותנו */}
          <View style={{margin: 16, backgroundColor: '#222', borderRadius: 12, padding: 16}}>
            <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 8}}>ערוך טקסט הכירו אותנו</Text>
            <TextInput
              value={aboutUsText}
              onChangeText={setAboutUsText}
              placeholder="הכנס טקסט הכירו אותנו..."
              style={{backgroundColor: '#333', color: '#fff', borderRadius: 8, padding: 8, minHeight: 80, marginBottom: 8}}
              placeholderTextColor="#aaa"
              multiline
            />
            <TouchableOpacity style={{backgroundColor: '#007bff', borderRadius: 8, padding: 12, marginTop: 8}} onPress={handleSaveAboutUs} disabled={aboutUsLoading}>
              <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>{aboutUsLoading ? 'שומר...' : 'שמור טקסט'}</Text>
            </TouchableOpacity>
          </View>

          {/* Admin Menu Grid */}
          <View style={styles.menuGrid}>
            {adminMenuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => {
                  if (item.screen === 'home') {
                    showToast('עובר לתצוגת לקוח');
                  } else {
                    showToast(`פותח ${item.title}`);
                  }
                  onNavigate(item.screen);
                }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={28} color="#fff" />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>סטטיסטיקות מהירות</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>12</Text>
                <Text style={styles.statLabel}>תורים היום</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>3</Text>
                <Text style={styles.statLabel}>ספרים פעילים</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>8</Text>
                <Text style={styles.statLabel}>טיפולים</Text>
              </View>
            </View>
          </View>

          {/* Initialize Collections Button */}
          <View style={styles.initSection}>
            <TouchableOpacity
              style={styles.initButton}
              onPress={async () => {
                try {
                  await initializeCollections();
                  showToast('Collections initialized successfully!');
                } catch (error) {
                  showToast('Error initializing collections', 'error');
                }
              }}
            >
              <Text style={styles.initButtonText}>Initialize Database Collections</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'monospace',
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
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeGradient: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  menuGrid: {
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'right',
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  statsSection: {
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
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  initSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  initButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  initButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  systemSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  systemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'right',
  },
  systemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
  },
  systemInfo: {
    flex: 1,
  },
  systemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  systemStatus: {
    fontSize: 14,
    color: '#28a745',
    textAlign: 'right',
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#28a745',
  },
});

export default AdminHomeScreen;