import { PlayfairDisplay_700Bold, useFonts } from '@expo-google-fonts/playfair-display';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { colors } from '../constants/colors';

interface TopNavProps {
  title: string;
  onBellPress?: () => void;
  onMenuPress?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
  showCloseButton?: boolean;
  onClosePress?: () => void;
  customBellIcon?: React.ReactNode;
}

const TopNav: React.FC<TopNavProps> = ({ 
  title, 
  onBellPress, 
  onMenuPress, 
  showBackButton = false, 
  onBackPress, 
  showCloseButton = false, 
  onClosePress,
  customBellIcon
}) => {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const animationProgress = useSharedValue(0);
  
  const handleMenuPress = () => {
    if (isOpen) {
      animationProgress.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    } else {
      animationProgress.value = withSpring(1, { damping: 15, stiffness: 120 });
    }
    setIsOpen(!isOpen);
    onMenuPress?.();
  };

  // Hamburger line animations (☰ → ✕)
  const animatedLine1Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(animationProgress.value, [0, 1], [0, 4]) },
      { rotate: `${interpolate(animationProgress.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  const animatedLine2Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(animationProgress.value, [0, 1], [0, -4]) },
      { rotate: `${interpolate(animationProgress.value, [0, 1], [0, -45])}deg` },
    ],
  }));

  if (!fontsLoaded) return null;
  return (
    <View style={styles.container}>
      {/* Bottom gold border gradient */}
      <LinearGradient
        colors={[colors.barberGoldDark, colors.barberGold, colors.barberGoldLight, colors.barberGold, colors.barberGoldDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={styles.bottomBorder}
        pointerEvents="none"
      />

      {/* Subtle background gradient */}
      <LinearGradient
        colors={['#000000', '#0a0a0a', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />
      
      {/* Content wrapper */}
      <View style={styles.contentWrapper}>
        {/* Left icon with gold background - Animated hamburger */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[colors.barberGoldLight, colors.barberGold, colors.barberGoldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.5, 1]}
            style={styles.iconGradient}
          >
            <TouchableOpacity style={styles.iconLeft} onPress={showBackButton ? onBackPress : handleMenuPress}>
              {showBackButton ? (
                <Ionicons name="arrow-back" size={24} color="#000" />
              ) : (
                <View style={styles.hamburgerContainer}>
                  <Animated.View style={[styles.hamburgerLine, animatedLine1Style]} />
                  <Animated.View style={[styles.hamburgerLine, animatedLine2Style]} />
                </View>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Title with gold accent */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { fontFamily: 'PlayfairDisplay_700Bold' }]}>{title}</Text>
          <View style={styles.titleUnderline}>
            <LinearGradient
              colors={[colors.barberGoldDark, colors.barberGold, colors.barberGoldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.underlineGradient}
            />
          </View>
        </View>
      
        {/* Right icon with gold background */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[colors.barberGoldLight, colors.barberGold, colors.barberGoldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.5, 1]}
            style={styles.iconGradient}
          >
            <TouchableOpacity style={styles.iconRight} onPress={showCloseButton ? onClosePress : onBellPress}>
              {showCloseButton ? (
                <Ionicons name="close" size={24} color="#000" />
              ) : customBellIcon ? (
                customBellIcon
              ) : (
                <Ionicons name="notifications-outline" size={24} color="#000" />
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 90,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    elevation: 8,
    shadowColor: colors.barberGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  hamburgerContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    backgroundColor: '#000',
    borderRadius: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 3,
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 35,
    zIndex: 2,
  },
  iconContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.barberGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  iconGradient: {
    borderRadius: 12,
  },
  iconLeft: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRight: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  titleUnderline: {
    width: '60%',
    height: 2,
    marginTop: 4,
    overflow: 'hidden',
    borderRadius: 1,
  },
  underlineGradient: {
    flex: 1,
  },
});

export default TopNav;
