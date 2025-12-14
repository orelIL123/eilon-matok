import { useRouter } from 'expo-router';
import React from 'react';
import AdminStatisticsScreen from './screens/AdminStatisticsScreen';

export default function AdminStatisticsTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Statistics navigating to:', screen);
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
    <AdminStatisticsScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
} 