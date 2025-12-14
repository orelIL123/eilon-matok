import React from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';

export default function TermsScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('terms.title')}</Text>
        <Text style={styles.section}>{t('terms.section1')}</Text>
        <Text style={styles.heading}>{t('terms.heading1')}</Text>
        <Text style={styles.section}>{t('terms.section2')}</Text>
        <Text style={styles.heading}>{t('terms.heading2')}</Text>
        <Text style={styles.section}>{t('terms.section3')}</Text>
        <Text style={styles.heading}>{t('terms.heading3')}</Text>
        <Text style={styles.section}>{t('terms.section4')}</Text>
        <Text style={styles.heading}>{t('terms.heading4')}</Text>
        <Text style={styles.section}>{t('terms.section5')}</Text>
        <Text style={styles.heading}>{t('terms.heading5')}</Text>
        <Text style={styles.section}>{t('terms.section6')}</Text>
        <Text style={styles.heading}>{t('terms.heading6')}</Text>
        <Text style={styles.section}>{t('terms.section7')}</Text>
        <Text style={styles.heading}>{t('terms.heading7')}</Text>
        <Text style={styles.section}>{t('terms.section8')}</Text>
        <Text style={styles.heading}>{t('terms.heading8')}</Text>
        <Text style={styles.section}>{t('terms.section9')}</Text>
        <Text style={styles.heading}>{t('terms.heading9')}</Text>
        <Text style={styles.section}>{t('terms.section10')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 18,
    marginBottom: 4,
  },
  section: {
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 24,
    textAlign: 'right',
  },
}); 