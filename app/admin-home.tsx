import { useRouter } from 'expo-router';
import AdminHomeScreen from './screens/AdminHomeScreen';

export default function AdminHomeTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Home navigating to:', screen);
    switch (screen) {
      case 'home':
        router.replace('/');
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
      case 'admin-statistics':
        router.replace('/admin-statistics');
        break;
      case 'admin-notifications':
        router.replace('/admin-notifications');
        break;
      case 'admin-settings':
        router.replace('/admin-settings');
        break;
      case 'admin-notification-settings':
        router.replace('/admin-notification-settings');
        break;
      case 'admin-customers':
        router.replace('/admin-customers');
        break;
      case 'admin-waitlist':
        router.replace('/admin-waitlist');
        break;
      case 'settings':
        router.replace('/settings');
        break;
      default:
        router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    // Navigate to home tabs instead of using router.back()
    // This ensures consistent navigation behavior
    router.replace('/(tabs)');
  };

  return (
    <AdminHomeScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}