import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { checkIsAdmin, getCurrentUser } from '../../services/firebase';
import { changeLanguage } from '../i18n';

const { width } = Dimensions.get('window');

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  onNotificationPress?: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ visible, onClose, onNavigate, onNotificationPress }) => {
  const { t, i18n } = useTranslation();
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      const user = getCurrentUser();
      if (user) {
        const adminStatus = await checkIsAdmin(user.uid);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
    };
    
    if (visible) {
      checkAdminStatus();
    }
  }, [visible]);
  
  const handleMenuPress = (screen: string) => {
    console.log('Menu item pressed, navigating to:', screen);
    onClose();
    setTimeout(() => {
      onNavigate(screen);
    }, 100);
  };
  
  const handleLanguageChange = async (languageCode: string) => {
    try {
      await changeLanguage(languageCode);
      setShowLanguageOptions(false);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleNotificationPress = () => {
    console.log('Notification pressed');
    onClose();
    setTimeout(() => {
      onNotificationPress && onNotificationPress();
    }, 100);
  };

  const menuItems = [
    { id: 'language', title: t('settings.language'), icon: 'language', screen: null },
    { id: 'notifications', title: t('settings.notifications'), icon: 'notifications', screen: null },
    { id: 'appointments', title: t('profile.my_appointments'), icon: 'calendar-today', screen: 'my-appointments' },
    { id: 'settings', title: t('nav.settings'), icon: 'settings', screen: 'settings' },
    ...(isAdmin ? [{ id: 'admin', title: t('nav.admin'), icon: 'admin-panel-settings', screen: 'admin-home' }] : []),
    { id: 'about', title: t('nav.about') || 'אודות', icon: 'info', screen: null },
  ];

  const aboutText = `ברוכים הבאים למספרת אילון מתוק!

אנחנו מספרה משפחתית בבאר שבע, מתמחים בתספורות גברים, תספורות ילדים וטיפוח אישי. 

הצוות שלנו מנוסה ומקצועי, וכל לקוח מקבל יחס אישי ותשומת לב. אנחנו משתמשים במוצרים איכותיים ומקפידים על ניקיון והיגיינה.

בואו להתרענן, להרגיש בבית ולצאת עם תספורת שתתאים לכם בדיוק.`;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} />
        <SafeAreaView style={styles.menuContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('home.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.menuContent}>
            {menuItems.map((item) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    console.log('Menu item pressed:', item.title);
                    if (item.id === 'language') {
                      setShowLanguageOptions(!showLanguageOptions);
                    } else if (item.id === 'notifications') {
                      handleNotificationPress();
                    } else if (item.id === 'about') {
                      setShowAbout(true);
                    } else if (item.screen) {
                      handleMenuPress(item.screen);
                    } else {
                      console.log('No action for', item.title);
                    }
                  }}
                >
                  <MaterialIcons name={item.icon as any} size={24} color="#fff" />
                  <Text style={styles.menuItemText}>{item.title}</Text>
                  {item.id === 'language' ? (
                    <Ionicons name={showLanguageOptions ? "chevron-down" : "chevron-forward"} size={20} color="#666" />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  )}
                </TouchableOpacity>
                
                {/* Language Options Submenu */}
                {item.id === 'language' && showLanguageOptions && (
                  <View style={styles.languageSubmenu}>
                    <TouchableOpacity
                      style={[styles.languageOption, i18n.language === 'he' && styles.activeLanguage]}
                      onPress={() => handleLanguageChange('he')}
                    >
                      <Text style={[styles.languageText, i18n.language === 'he' && styles.activeLanguageText]}>
                        {t('settings.hebrew')}
                      </Text>
                      {i18n.language === 'he' && <Ionicons name="checkmark" size={20} color="#8B4513" />}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.languageOption, i18n.language === 'en' && styles.activeLanguage]}
                      onPress={() => handleLanguageChange('en')}
                    >
                      <Text style={[styles.languageText, i18n.language === 'en' && styles.activeLanguageText]}>
                        {t('settings.english')}
                      </Text>
                      {i18n.language === 'en' && <Ionicons name="checkmark" size={20} color="#8B4513" />}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('common.version') || 'גרסה'} 1.0.0</Text>
            <Text style={styles.footerCredit}>{t('home.powered_by')}</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* About Modal */}
      <Modal
        visible={showAbout}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAbout(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#111', borderRadius: 16, padding: 24, maxWidth: 340, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>אודות</Text>
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'right', marginBottom: 24 }}>{aboutText}</Text>
            <TouchableOpacity onPress={() => setShowAbout(false)} style={{ backgroundColor: '#007bff', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  overlayTouch: {
    flex: 1,
  },
  menuContainer: {
    width: width * 0.8,
    backgroundColor: '#1a1a1a',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  closeButton: {
    padding: 8,
  },
  menuContent: {
    flex: 1,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 16,
    marginRight: 16,
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footerCredit: {
    fontSize: 12,
    color: '#888',
  },
  languageSubmenu: {
    marginTop: 8,
    marginLeft: 40,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#333',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
  },
  activeLanguage: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  languageText: {
    fontSize: 14,
    color: '#ccc',
  },
  activeLanguageText: {
    color: '#8B4513',
    fontWeight: '600',
  },
});

export default SideMenu;