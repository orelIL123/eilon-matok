import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Image,
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
import { registerUserWithPhone, sendSMSVerification } from '../../services/firebase';
import { colors } from '../constants/colors';
import { CONTACT_INFO } from '../constants/contactInfo';

const { width: screenWidth } = Dimensions.get('window');

type RegisterStep = 'fullName' | 'phone' | 'password' | 'verification';

const STEP_ORDER: RegisterStep[] = ['fullName', 'phone', 'password', 'verification'];

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<RegisterStep>('fullName');
  const [verificationId, setVerificationId] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentStepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, step]);

  const handleSendVerification = async () => {
    if (!fullName.trim()) {
      Alert.alert('שגיאה', 'אנא הזן שם מלא');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('שגיאה', 'אנא הזן מספר טלפון');
      return;
    }

    if (!password.trim()) {
      Alert.alert('שגיאה', 'אנא הזן סיסמה');
      return;
    }

    if (password.length < 6) {
      Alert.alert('שגיאה', 'סיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);
    try {
      const result = await sendSMSVerification(phone);
      console.log('📱 Received verificationId:', result.verificationId);
      setVerificationId(result.verificationId);
      setStep('verification');
      Alert.alert('הצלחה', 'קוד אימות נשלח לטלפון שלך');
    } catch (error: any) {
      console.error('SMS verification error:', error);
      Alert.alert('שגיאה', 'לא ניתן לשלוח קוד אימות');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('שגיאה', 'אנא הזן קוד אימות');
      return;
    }

    console.log('🔐 Attempting verification with:', {
      verificationId,
      verificationCode,
      verificationCodeType: typeof verificationCode,
      phone,
      fullName
    });

    setLoading(true);
    try {
      await registerUserWithPhone(phone, fullName, verificationId, verificationCode, password);

      Alert.alert('הצלחה', 'נרשמת בהצלחה!', [
        { text: 'אישור', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));

      let errorMessage = 'שגיאה בהרשמה';

      if (error.message) {
        if (error.message.includes('Invalid verification code')) {
          errorMessage = 'קוד האימות שגוי. אנא נסה שוב.';
        } else if (error.message.includes('Verification ID not found')) {
          errorMessage = 'פג תוקף הקוד. אנא שלח קוד חדש.';
        } else if (error.message.includes('Verification code expired')) {
          errorMessage = 'פג תוקף הקוד. אנא שלח קוד חדש.';
        } else if (error.message.includes('email-already-in-use')) {
          errorMessage = 'כבר קיים חשבון עם מספר הטלפון הזה.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('שגיאה', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'fullName') {
      router.replace('/auth-choice');
      return;
    }

    if (step === 'verification') {
      setVerificationCode('');
      setStep('password');
      return;
    }

    const previousStep = STEP_ORDER[currentStepIndex - 1];
    if (previousStep) {
      setStep(previousStep);
    }
  };

  const handleStepSubmit = () => {
    if (step === 'fullName') {
      if (!fullName.trim()) {
        Alert.alert('שגיאה', 'אנא הזן שם מלא');
        return;
      }
      setStep('phone');
      return;
    }

    if (step === 'phone') {
      if (!phone.trim()) {
        Alert.alert('שגיאה', 'אנא הזן מספר טלפון');
        return;
      }
      setStep('password');
      return;
    }

    if (step === 'password') {
      handleSendVerification();
      return;
    }

    handleVerifyAndRegister();
  };

  const actionText = step === 'verification'
    ? 'אמת והירשם'
    : step === 'password'
      ? 'שלח קוד אימות'
      : 'המשך';

  const stepTitle = step === 'fullName'
    ? 'איך קוראים לך?'
    : step === 'phone'
      ? 'מה מספר הטלפון שלך?'
      : step === 'password'
        ? 'בחר סיסמה לחשבון'
        : 'אימות מספר טלפון';

  const stepSubtitle = step === 'fullName'
    ? 'שם מלא יעזור לנו לזהות אותך במערכת'
    : step === 'phone'
      ? 'נשלח קוד אימות בהודעת SMS'
      : step === 'password'
        ? 'לפחות 6 תווים'
        : `נשלח קוד אימות ל-${phone}`;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color="#221a16" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>הרשמה</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.progressRow}>
          {STEP_ORDER.map((item, index) => {
            const isActive = index <= currentStepIndex;
            return <View key={item} style={[styles.progressItem, isActive && styles.progressItemActive]} />;
          })}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.logoSection}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
              <Text style={styles.title}>{stepTitle}</Text>
              <Text style={styles.subtitle}>{stepSubtitle}</Text>

              <View style={styles.formSection}>
                {step === 'fullName' && (
                  <>
                    <Text style={styles.label}>שם מלא</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="הזן שם מלא"
                      placeholderTextColor="#9b8f88"
                      value={fullName}
                      onChangeText={setFullName}
                      returnKeyType="next"
                      onSubmitEditing={handleStepSubmit}
                      textAlign="right"
                    />
                  </>
                )}

                {step === 'phone' && (
                  <>
                    <Text style={styles.label}>מספר טלפון</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="הזן מספר טלפון"
                      placeholderTextColor="#9b8f88"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                      onSubmitEditing={handleStepSubmit}
                      textAlign="right"
                    />
                  </>
                )}

                {step === 'password' && (
                  <>
                    <Text style={styles.label}>סיסמה</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="הזן סיסמה (לפחות 6 תווים)"
                      placeholderTextColor="#9b8f88"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      returnKeyType="go"
                      onSubmitEditing={handleStepSubmit}
                      textAlign="right"
                    />
                  </>
                )}

                {step === 'verification' && (
                  <>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>שם מלא: {fullName}</Text>
                      <Text style={styles.summaryLabel}>טלפון: {phone}</Text>
                    </View>
                    <Text style={styles.label}>קוד אימות</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="הזן קוד אימות"
                      placeholderTextColor="#9b8f88"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="go"
                      onSubmitEditing={handleStepSubmit}
                      textAlign="center"
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.registerButton, loading && styles.buttonDisabled]}
                  onPress={handleStepSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.registerButtonText}>{actionText}</Text>
                  )}
                </TouchableOpacity>

                {step !== 'verification' && (
                  <>
                    <TouchableOpacity onPress={() => router.push('/login')}>
                      <Text style={styles.linkText}>יש לך חשבון? התחבר</Text>
                    </TouchableOpacity>

                    <Text style={styles.termsText}>
                      בהמשך השימוש באפליקציה, אתה מסכים ל{' '}
                      <Text style={styles.termsLink} onPress={() => setShowTerms(true)}>תנאי השימוש</Text>
                      {' '}ול{' '}
                      <Text style={styles.termsLink} onPress={() => setShowTerms(true)}>מדיניות הפרטיות</Text>
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showTerms} transparent={true} animationType="fade" onRequestClose={() => setShowTerms(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>תנאי שימוש ומדיניות פרטיות</Text>
            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalText}>
                <Text style={styles.sectionTitle}>תנאי שימוש - אילון מתוק מספרה{'\n\n'}</Text>
                <Text style={styles.subsectionTitle}>1. קבלת השירות{'\n'}</Text>
                • השירות מיועד לקביעת תורים במספרת אילון מתוק{'\n'}
                • יש לספק מידע מדויק ומלא בעת קביעת התור{'\n'}
                • המספרה שומרת לעצמה את הזכות לסרב לתת שירות במקרים חריגים{'\n\n'}

                <Text style={styles.subsectionTitle}>2. ביטול תורים{'\n'}</Text>
                • ביטול תור יש לבצע לפחות 2 שעות לפני מועד התור{'\n'}
                • ביטול מאוחר יותר מ-2 שעות עלול לחייב תשלום{'\n'}
                • במקרה של איחור של יותר מ-15 דקות, התור עלול להתבטל{'\n\n'}

                <Text style={styles.subsectionTitle}>3. תשלומים{'\n'}</Text>
                • התשלום מתבצע במספרה לאחר קבלת השירות{'\n'}
                • המחירים כפי שמופיעים באפליקציה{'\n'}
                • המספרה שומרת לעצמה את הזכות לשנות מחירים{'\n\n'}

                <Text style={styles.subsectionTitle}>4. אחריות{'\n'}</Text>
                • המספרה מתחייבת לאיכות השירות{'\n'}
                • במקרה של אי שביעות רצון, יש לפנות למנהל המספרה{'\n'}
                • המספרה לא אחראית לנזקים עקיפים{'\n\n'}

                <Text style={styles.sectionTitle}>מדיניות פרטיות{'\n\n'}</Text>

                <Text style={styles.subsectionTitle}>1. איסוף מידע{'\n'}</Text>
                • אנו אוספים: שם מלא, מספר טלפון, פרטי תורים{'\n'}
                • המידע נאסף לצורך מתן השירות בלבד{'\n'}
                • לא נאסוף מידע מיותר{'\n\n'}

                <Text style={styles.subsectionTitle}>2. שימוש במידע{'\n'}</Text>
                • המידע משמש לקביעת תורים ותקשורת{'\n'}
                • לא נשתף את המידע עם צדדים שלישיים{'\n'}
                • לא נשלח הודעות פרסומיות ללא אישור{'\n\n'}

                <Text style={styles.subsectionTitle}>3. אבטחה{'\n'}</Text>
                • המידע מאוחסן באופן מאובטח{'\n'}
                • גישה למידע מוגבלת לעובדי המספרה בלבד{'\n'}
                • נעדכן את האבטחה לפי הצורך{'\n\n'}

                <Text style={styles.subsectionTitle}>4. זכויות המשתמש{'\n'}</Text>
                • הזכות לבקש עותק מהמידע שלך{'\n'}
                • הזכות לבקש מחיקה של המידע{'\n'}
                • הזכות לעדכן את המידע{'\n\n'}

                <Text style={styles.subsectionTitle}>5. עדכונים{'\n'}</Text>
                • מדיניות זו עשויה להתעדכן{'\n'}
                • עדכונים יפורסמו באפליקציה{'\n'}
                • המשך השימוש מהווה הסכמה לתנאים המעודכנים{'\n\n'}

                <Text style={styles.contactInfo}>
                  {CONTACT_INFO.contactText}{'\n'}
                  מייל: {CONTACT_INFO.email}
                </Text>
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowTerms(false)}>
              <Text style={styles.modalCloseText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0ea',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9dfd4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f1a16',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  progressRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  progressItem: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#ddd2c6',
  },
  progressItemActive: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: screenWidth * 0.2,
    height: screenWidth * 0.2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ebe1d7',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f1a16',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 15,
    color: '#8a7565',
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 22,
    lineHeight: 21,
  },
  formSection: {
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2f261f',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#fffaf5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1f1a16',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7dacc',
  },
  summaryBox: {
    backgroundColor: '#f5f0ea',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5d8c9',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#5c4c3f',
    textAlign: 'right',
    marginBottom: 4,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  linkText: {
    fontSize: 15,
    color: colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 13,
    color: '#756354',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 14,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    alignItems: 'stretch',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalScrollView: {
    width: '100%',
    flex: 1,
  },
  modalText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 5,
  },
  contactInfo: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
  },
  modalCloseButton: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
