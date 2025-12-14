import { useRouter } from 'expo-router';
import TeamScreenComponent from '../screens/TeamScreen';

export default function TeamTab() {
  const router = useRouter();

  const handleNavigate = (screen: string, params?: any) => {
    switch (screen) {
      case 'home':
        router.replace('/');
        break;
      case 'profile':
        router.replace('/profile');
        break;
      case 'booking':
        if (params) {
          router.push({
            pathname: '/booking',
            params
          });
        } else {
          router.replace('/booking');
        }
        break;
      case 'explore':
        router.replace('/explore');
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
    <TeamScreenComponent 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
} 