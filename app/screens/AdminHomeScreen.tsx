import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { checkIsAdmin, makeCurrentUserAdmin, onAuthStateChange } from '../../services/firebase';
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ ...toast, visible: false });
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


          {/* Admin Menu Grid - Card Layout */}
          <View style={styles.menuGrid}>
            {adminMenuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuCard}
                onPress={() => {
                  if (item.screen === 'home') {
                    showToast('עובר לתצוגת לקוח');
                  } else {
                    showToast(`פותח ${item.title}`);
                  }
                  onNavigate(item.screen);
                }}
              >
                <View style={[styles.cardIconContainer, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={32} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  menuCard: {
    width: (width - 48) / 2, // 2 cards per row with spacing
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AdminHomeScreen;