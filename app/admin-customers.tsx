import { useRouter } from 'expo-router';
import React from 'react';
import AdminCustomersScreen from './screens/AdminCustomersScreen';

export default function AdminCustomersTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Customers navigating to:', screen);
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
    <AdminCustomersScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}
