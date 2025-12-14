import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

export default function SplashScreen() {
  const navigation = useNavigation();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [splashImageUrl, setSplashImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch splash image from Firebase
    const fetchSplashImage = async () => {
      try {
        const db = getFirestore();
        const splashQuery = query(
          collection(db, 'gallery'),
          where('type', '==', 'splash'),
          where('isActive', '==', true)
        );
        const splashSnapshot = await getDocs(splashQuery);
        
        if (!splashSnapshot.empty) {
          const splashImages = splashSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          splashImages.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          
          if (splashImages.length > 0 && splashImages[0].imageUrl) {
            setSplashImageUrl(splashImages[0].imageUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching splash image:', error);
      }
    };
    
    fetchSplashImage();

    // Start fade in animation only (no scale effect)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Navigate after 2 seconds
    const timer = setTimeout(() => {
      (navigation as any).navigate('(tabs)');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {splashImageUrl ? (
          <Image
            source={{ uri: splashImageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.image, { backgroundColor: '#000' }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // רקע כהה
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
}); 