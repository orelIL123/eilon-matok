import { useRouter } from 'expo-router';
import BookingScreen from './screens/BookingScreen';

export default function Booking() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    switch (screen) {
      case 'home':
        router.replace('/(tabs)');
        break;
      case 'profile':
        router.replace('/(tabs)/profile');
        break;
      case 'team':
        router.replace('/(tabs)/team');
        break;
      case 'explore':
        router.replace('/(tabs)/explore');
        break;
      default:
        router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    router.replace('/(tabs)');
  };

  const handleClose = () => {
    router.replace('/(tabs)');
  };

  return (
    <BookingScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
      onClose={handleClose}
    />
  );
}
