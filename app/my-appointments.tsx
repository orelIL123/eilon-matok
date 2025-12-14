import React from 'react';
import MyAppointmentsScreen from './screens/MyAppointmentsScreen';
import { useRouter } from 'expo-router';

export default function MyAppointmentsPage() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('My Appointments navigating to:', screen);
    switch (screen) {
      case 'booking':
        router.push('/(tabs)/booking');
        break;
      case 'profile':
        router.push('/(tabs)/profile');
        break;
      case 'home':
        router.replace('/');
        break;
      default:
        router.push('/(tabs)/profile');
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <MyAppointmentsScreen
      onNavigate={handleNavigate}
      onBack={handleBack}
    />
  );
}
