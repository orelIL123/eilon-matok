import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';

interface ScissorsLoaderProps {
  size?: number;
  color?: string;
  style?: any;
}

export const ScissorsLoader: React.FC<ScissorsLoaderProps> = ({
  size = 60,
  color = colors.barberGold,
  style,
}) => {
  const loadingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Scissors animation loop
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(loadingAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ])
    );
    
    animation.start();
    
    return () => {
      animation.stop();
    };
  }, [loadingAnim]);

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={{
          transform: [{
            rotate: loadingAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['-15deg', '15deg']
            })
          }]
        }}
      >
        <Ionicons name="cut" size={size} color={color} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ScissorsLoader;
