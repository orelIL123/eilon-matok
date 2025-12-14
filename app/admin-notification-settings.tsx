import { useRouter } from 'expo-router';
import AdminNotificationSettingsScreen from './screens/AdminNotificationSettingsScreen';

export default function AdminNotificationSettingsTab() {
  const router = useRouter();

  const handleNavigate = (screen: string) => {
    console.log('Admin Notification Settings navigating to:', screen);
    switch (screen) {
      case 'admin-home':
        router.replace('/admin-home');
        break;
      case 'admin-notifications':
        router.replace('/admin-notifications');
        break;
      case 'home':
        router.replace('/(tabs)');
        break;
      default:
        console.log('Unknown navigation target:', screen);
    }
  };

  const handleBack = () => {
    console.log('Admin Notification Settings back pressed');
    // Navigate to admin settings instead of using router.back()
    // This ensures consistent navigation behavior
    router.replace('/admin-settings');
  };

  return (
    <AdminNotificationSettingsScreen 
      onNavigate={handleNavigate} 
      onBack={handleBack}
    />
  );
}