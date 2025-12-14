import { useLocalSearchParams, useRouter } from 'expo-router';
import ProfileScreen from '../screens/ProfileScreen';

export default function ProfileTab() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const handleNavigate = (screen: string) => {
    switch (screen) {
      case 'home':
        router.replace('/');
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
      case 'auth-choice':
        router.replace('/auth-choice');
        break;
      case 'my-appointments':
        router.push('/my-appointments');
        break;
      default:
        router.replace('/');
    }
  };

  const handleBack = () => {
    // Always navigate to home tabs instead of using router.back()
    // This ensures consistent navigation behavior
    router.replace('/(tabs)');
  };

  return (
    <ProfileScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
      // initialMode={mode}
    />
  );
} 