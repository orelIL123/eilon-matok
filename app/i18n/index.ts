import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import he from './locales/he.json';
import en from './locales/en.json';

const resources = {
  he: { translation: he },
  en: { translation: en }
};

const initI18n = async () => {
  let savedLanguage = 'he'; // Default to Hebrew
  
  try {
    const stored = await AsyncStorage.getItem('app_language');
    if (stored) {
      savedLanguage = stored;
    }
  } catch (error) {
    console.log('Error loading saved language:', error);
  }

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'he',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
};

export const changeLanguage = async (language: string) => {
  try {
    await AsyncStorage.setItem('app_language', language);
    i18n.changeLanguage(language);
  } catch (error) {
    console.log('Error saving language:', error);
  }
};

// Initialize
initI18n();

export default i18n;