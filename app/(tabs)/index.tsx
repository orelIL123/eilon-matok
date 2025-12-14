import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import HomeScreen from '../screens/HomeScreen';

export default function HomeTab() {
  const router = useRouter();
  const { guest } = useLocalSearchParams<{ guest?: string }>();
  const isGuestMode = guest === 'true';

  const handleNavigate = (screen: string) => {
    console.log('handleNavigate called with screen:', screen);
    switch (screen) {
      case 'profile':
        router.replace('/profile');
        break;
      case 'team':
        router.replace('/team');
        break;
      case 'booking':
        router.replace('/booking');
        break;
      case 'explore':
        router.replace('/explore');
        break;
      case 'settings':
        router.replace('/settings');
        break;
      case 'my-appointments':
        router.push('/my-appointments');
        break;
      case 'admin-home':
        router.replace('/admin-home');
        break;
      case 'admin-appointments':
        router.replace('/admin-appointments');
        break;
      case 'admin-treatments':
        router.replace('/admin-treatments');
        break;
      case 'admin-team':
        router.replace('/admin-team');
        break;
      case 'admin-gallery':
        router.replace('/admin-gallery');
        break;
      case 'admin-availability':
        router.replace('/admin-availability');
        break;
      case 'admin-settings':
        router.replace('/admin-settings');
        break;
      case 'auth-choice':
        console.log('Navigating to AuthChoiceScreen');
        router.push('/auth-choice');
        break;
      case 'home':
        router.replace('/(tabs)');
        break;
      default:
        console.log('Unknown screen:', screen);
        router.replace('/(tabs)');
    }
  };

  return (
    <HomeScreen onNavigate={handleNavigate} isGuestMode={isGuestMode} />
  );
}