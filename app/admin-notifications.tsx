import { useRouter } from 'expo-router';
import React from 'react';
import AdminNotificationsScreen from './screens/AdminNotificationsScreen';

export default function AdminNotificationsTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Notifications navigating to:', screen);
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
    <AdminNotificationsScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
} 