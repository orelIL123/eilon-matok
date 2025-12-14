import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
  animationSpeed?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animationSpeed = 1000
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: animationSpeed,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: animationSpeed,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    animate();
  }, [animatedValue, animationSpeed]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: typeof width === 'string' ? parseInt(width) : width,
          height: typeof height === 'string' ? parseInt(height) : height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Pre-built skeleton components for common use cases
export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.card, style]}>
    <SkeletonLoader width="100%" height={120} borderRadius={8} style={{ marginBottom: 12 }} />
    <SkeletonLoader width="80%" height={16} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="60%" height={14} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="40%" height={12} />
  </View>
);

export const SkeletonListItem: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.listItem, style]}>
    <SkeletonLoader width={60} height={60} borderRadius={30} style={{ marginRight: 16 }} />
    <View style={{ flex: 1 }}>
      <SkeletonLoader width="70%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="50%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="30%" height={12} />
    </View>
  </View>
);

export const SkeletonAppointmentCard: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.appointmentCard, style]}>
    <View style={styles.appointmentHeader}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonLoader width="60%" height={16} style={{ marginBottom: 4 }} />
        <SkeletonLoader width="40%" height={14} />
      </View>
      <SkeletonLoader width={80} height={24} borderRadius={12} />
    </View>
    <View style={styles.appointmentBody}>
      <SkeletonLoader width="50%" height={14} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="70%" height={14} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="30%" height={14} />
    </View>
  </View>
);

export const SkeletonGallery: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.gallery, style]}>
    {Array.from({ length: 6 }).map((_, index) => (
      <SkeletonLoader
        key={index}
        width="48%"
        height={120}
        borderRadius={8}
        style={{ marginBottom: 8 }}
      />
    ))}
  </View>
);

export const SkeletonStatCard: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.statCard, style]}>
    <SkeletonLoader width={40} height={40} borderRadius={20} style={{ marginBottom: 12 }} />
    <SkeletonLoader width="80%" height={20} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="60%" height={14} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentBody: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});