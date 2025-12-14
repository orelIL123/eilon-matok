import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { getCurrentUser, getUserProfile } from '../../services/firebase';
import ShopScreen from './explore-client';

export default function ExploreTab() {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    (async () => {
      const user = getCurrentUser();
      if (user) {
        const profile = await getUserProfile(user.uid);
        setIsAdmin(profile?.isAdmin === true);
      }
    })();
  }, []);

  const handleNavigate = (screen: string) => {
    switch (screen) {
      case 'home':
        router.replace('/(tabs)');
        break;
      case 'profile':
        router.replace('/profile');
        break;
      default:
        router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    router.replace('/(tabs)');
  };

  // Both admin and clients can view the shop
  // Admin gets additional features for shop management via AdminGalleryScreen
  return <ShopScreen onNavigate={handleNavigate} onBack={handleBack} isAdmin={isAdmin} />;
}
