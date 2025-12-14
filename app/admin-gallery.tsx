import React from 'react';
import AdminGalleryScreen from './screens/AdminGalleryScreen';
import { useRouter } from 'expo-router';

export default function AdminGalleryTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Gallery navigating to:', screen);
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
    <AdminGalleryScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}