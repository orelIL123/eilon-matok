import { useRouter } from 'expo-router';
import React from 'react';
import AdminSettingsScreen from './screens/AdminSettingsScreen';

export default function AdminSettingsPage() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    switch (screen) {
      case 'admin-home':
        router.replace('/admin-home');
        break;
      case 'home':
        router.replace('/(tabs)');
        break;
      default:
        router.replace('/admin-home');
    }
  };

  const handleBack = () => {
    router.replace('/admin-home');
  };

  return (
    <AdminSettingsScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}