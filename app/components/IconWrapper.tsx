import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';

// Wrapper for Ionicons to work with React 19
export const IconWrapper = React.forwardRef<any, any>((props, ref) => {
  return <Ionicons {...props} ref={ref} />;
});
IconWrapper.displayName = 'IconWrapper';

// Wrapper for LinearGradient to work with React 19
export const GradientWrapper = React.forwardRef<any, any>((props, ref) => {
  // Ensure colors prop is provided
  const { colors = ['#000000', '#ffffff'], ...restProps } = props;
  return <LinearGradient colors={colors} {...restProps} ref={ref} />;
});
GradientWrapper.displayName = 'GradientWrapper';

// Wrapper for Feather icons to work with React 19
export const FeatherWrapper = React.forwardRef<any, any>((props, ref) => {
  return <Feather {...props} ref={ref} />;
});
FeatherWrapper.displayName = 'FeatherWrapper';

// Export the original components for backward compatibility
export { Feather, Ionicons, LinearGradient };

