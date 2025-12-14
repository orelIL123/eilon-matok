import { Stack, useRouter } from 'expo-router';
import AdminWaitlistScreen from './screens/AdminWaitlistScreen';

export default function AdminWaitlistTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Waitlist navigating to:', screen);
    switch (screen) {
      case 'home':
        router.replace('/');
        break;
      case 'admin-home':
        router.replace('/admin-home');
        break;
      case 'admin-appointments':
        router.replace('/admin-appointments');
        break;
      case 'admin-notifications':
        router.replace('/admin-notifications');
        break;
      default:
        router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    router.replace('/admin-home');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AdminWaitlistScreen 
        onNavigate={handleNavigate} 
        onBack={handleBack}
      />
    </>
  );
}

