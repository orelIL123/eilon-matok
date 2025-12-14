import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import TermsModal from '../components/TermsModal';
import TopNav from '../components/TopNav';
import { changeLanguage } from '../i18n';

interface SettingsScreenProps {
  onNavigate: (screen: string) => void;
  onBack?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate, onBack }) => {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState(false);
  const [appointmentReminders, setAppointmentReminders] = useState(false);
  const [generalNotifications, setGeneralNotifications] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const languages = [
    { code: 'he', name: t('settings.hebrew'), flag: '🇮🇱' },
    { code: 'en', name: t('settings.english'), flag: '🇺🇸' }
  ];

  const handleLanguageChange = async (langCode: string) => {
    try {
      await changeLanguage(langCode);
      const selectedLang = languages.find(l => l.code === langCode);
      Alert.alert(
        t('settings.language_changed') || 'שינוי שפה',
        `${t('settings.language_changed_to') || 'השפה שונתה ל'} ${selectedLang?.name} ${selectedLang?.flag}`,
        [{ text: t('common.confirm'), style: 'default' }]
      );
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(t('common.error'), t('settings.language_change_error') || 'שגיאה בשינוי שפה');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'מחיקת חשבון',
      'האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו לא ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'מחק חשבון', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('מחיקת חשבון', 'החשבון יימחק בקרוב...');
          }
        }
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'מדיניות פרטיות',
      'אנו מתחייבים לשמור על פרטיותך ולהגן על המידע האישי שלך. כל הנתונים מוצפנים ומאובטחים.',
      [{ text: 'הבנתי', style: 'default' }]
    );
  };


  const handleSupport = () => {
    Linking.openURL('mailto:info@eilonmatok.com?subject=תמיכה באפליקציה').catch(() => {
      Alert.alert('שגיאה', 'לא ניתן לפתוח את אפליקציית המייל');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav 
        title={t('nav.settings')} 
        onBellPress={() => {}} 
        onMenuPress={() => {}}
        showBackButton={true}
        onBackPress={onBack || (() => onNavigate('home'))}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Language Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.settingItem,
                  i18n.language === lang.code && styles.selectedItem
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <Text style={styles.settingText}>{lang.name}</Text>
                </View>
                {i18n.language === lang.code && (
                  <Ionicons name="checkmark" size={20} color="#007bff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Notification Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications" size={20} color="#666" style={styles.settingIcon} />
                <Text style={styles.settingText}>{t('settings.general_notifications')}</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#ddd', true: '#007bff' }}
                thumbColor={notifications ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="time" size={20} color="#666" style={styles.settingIcon} />
                <Text style={styles.settingText}>{t('settings.appointment_reminders')}</Text>
              </View>
              <Switch
                value={appointmentReminders}
                onValueChange={setAppointmentReminders}
                trackColor={{ false: '#ddd', true: '#007bff' }}
                thumbColor={appointmentReminders ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="megaphone" size={20} color="#666" style={styles.settingIcon} />
                <Text style={styles.settingText}>{t('settings.barber_messages') || 'הודעות מהספר'}</Text>
              </View>
              <Switch
                value={generalNotifications}
                onValueChange={setGeneralNotifications}
                trackColor={{ false: '#ddd', true: '#007bff' }}
                thumbColor={generalNotifications ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Legal & Support */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.legal_support') || 'משפטי ותמיכה'}</Text>
            
            <TouchableOpacity style={styles.settingItem} onPress={handlePrivacyPolicy}>
              <View style={styles.settingLeft}>
                <Ionicons name="shield-checkmark" size={20} color="#666" style={styles.settingIcon} />
                <Text style={styles.settingText}>{t('settings.privacy_policy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowTerms(true)}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="document-text" size={20} color="#666" style={styles.settingIcon} />
                  <Text style={styles.settingText}>{t('settings.terms_of_service')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
            <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} />

            <TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
              <View style={styles.settingLeft}>
                <Ionicons name="help-circle" size={20} color="#666" style={styles.settingIcon} />
                <Text style={styles.settingText}>{t('settings.support') || 'תמיכה'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.danger_zone') || 'אזור מסוכן'}</Text>
            
            <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteAccount}>
              <View style={styles.settingLeft}>
                <Ionicons name="trash" size={20} color="#F44336" style={styles.settingIcon} />
                <Text style={styles.dangerText}>{t('settings.delete_account')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>אילון מתוק Barber App</Text>
            <Text style={styles.appVersionText}>{t('common.version') || 'גרסה'} 1.0.0</Text>
            <Text style={styles.appCreditText}>{t('home.powered_by')}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'right',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItem: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: -12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  dangerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dangerText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'right',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appInfoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  appVersionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  appCreditText: {
    fontSize: 12,
    color: '#999',
  },
  legalLink: {
    color: '#fff',
    fontSize: 16,
    marginVertical: 8,
    textAlign: 'right',
    textDecorationLine: 'underline',
  },
});

export default SettingsScreen;