import React from 'react';
import AdminTeamScreen from './screens/AdminTeamScreen';
import { useRouter } from 'expo-router';

export default function AdminTeamTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Team navigating to:', screen);
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
    <AdminTeamScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}