import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeAuthScreen() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace('/auth-choice');
  }, [router]);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {},
  logo: {
    width: 120,
    height: 120,
    marginBottom: 32,
    borderRadius: 60,
    backgroundColor: '#181828',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: '#b0b0b0',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 28,
  },
  button: {
    backgroundColor: '#8B4513',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 32,
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 18,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
}); 