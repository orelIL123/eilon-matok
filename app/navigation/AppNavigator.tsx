import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AdminAppointmentsScreen from '../screens/AdminAppointmentsScreen';
import AdminAvailabilityScreen from '../screens/AdminAvailabilityScreen';
import AdminGalleryScreen from '../screens/AdminGalleryScreen';
import AdminHomeScreen from '../screens/AdminHomeScreen';
import AdminNotificationSettingsScreen from '../screens/AdminNotificationSettingsScreen';
import AdminSettingsScreen from '../screens/AdminSettingsScreen';
import AdminTeamScreen from '../screens/AdminTeamScreen';
import AdminTreatmentsScreen from '../screens/AdminTreatmentsScreen';
import AdminWaitlistScreen from '../screens/AdminWaitlistScreen';
import BookingScreen from '../screens/BookingScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TeamScreen from '../screens/TeamScreen';

export type Screen = 'home' | 'profile' | 'team' | 'booking' | 'settings' | 'admin-home' | 'admin-appointments' | 'admin-treatments' | 'admin-team' | 'admin-gallery' | 'admin-availability' | 'admin-settings' | 'admin-notification-settings' | 'admin-waitlist';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [previousScreen, setPreviousScreen] = useState<Screen>('home');
  const [navigationParams, setNavigationParams] = useState<any>({});

  const handleNavigate = (screen: string, params?: any) => {
    console.log('🔀 Navigation requested:', screen, 'from:', currentScreen);
    setPreviousScreen(currentScreen);
    setCurrentScreen(screen as Screen);
    setNavigationParams(params || {});
  };

  const renderScreen = () => {
    console.log('🔄 AppNavigator rendering screen:', currentScreen);
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={handleNavigate} />;
      case 'profile':
        return <ProfileScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('home')}
        />;
      case 'team':
        return <TeamScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('home')}
        />;
      case 'booking':
        return <BookingScreen 
          onNavigate={handleNavigate} 
          route={{ params: navigationParams }}
          onBack={() => handleNavigate('home')}
          onClose={() => handleNavigate('home')}
        />;
      case 'settings':
        return <SettingsScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate(previousScreen)}
        />;
      case 'admin-home':
        return <AdminHomeScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('home')}
        />;
      case 'admin-appointments':
        return <AdminAppointmentsScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      case 'admin-treatments':
        return <AdminTreatmentsScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      case 'admin-team':
        return <AdminTeamScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      case 'admin-gallery':
        return <AdminGalleryScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      case 'admin-availability':
        return <AdminAvailabilityScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      case 'admin-settings':
        return <AdminSettingsScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      case 'admin-notification-settings':
        return <AdminNotificationSettingsScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-settings')}
        />;
      case 'admin-waitlist':
        return <AdminWaitlistScreen 
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('admin-home')}
        />;
      default:
        return <HomeScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppNavigator;