import { useRouter } from 'expo-router';
import BookingScreen from '../screens/BookingScreen';

export default function BookingTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    switch (screen) {
      case 'home':
        router.replace('/');
        break;
      case 'profile':
        router.replace('/profile');
        break;
      case 'team':
        router.replace('/team');
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

  const handleClose = () => {
    router.replace('/');
  };

  return (
    <BookingScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
      onClose={handleClose}
    />
  );
}