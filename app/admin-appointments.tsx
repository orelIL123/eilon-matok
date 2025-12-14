import React from 'react';
import AdminAppointmentsScreen from './screens/AdminAppointmentsScreen';
import { useRouter } from 'expo-router';

export default function AdminAppointmentsTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Appointments navigating to:', screen);
    switch (screen) {
      case 'admin-home':
        router.replace('/admin-home');
        break;
      case 'home':
        router.replace('/');
        break;
      default:
        router.replace('/admin-home');
    }
  };

  const handleBack = () => {
    router.replace('/admin-home');
  };

  return (
    <AdminAppointmentsScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}