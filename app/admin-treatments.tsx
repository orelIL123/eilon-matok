import React from 'react';
import AdminTreatmentsScreen from './screens/AdminTreatmentsScreen';
import { useRouter } from 'expo-router';

export default function AdminTreatmentsTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Treatments navigating to:', screen);
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
    <AdminTreatmentsScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}