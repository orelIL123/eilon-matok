import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../constants/colors';

interface CustomCardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'selected' | 'disabled';
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
}

export const CustomCard: React.FC<CustomCardProps> = ({
  title,
  subtitle,
  children,
  onPress,
  variant = 'default',
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const getCardColors = (): [string, string, string] => {
    switch (variant) {
      case 'selected':
        return [colors.barberGoldLight, colors.barberGold, colors.barberGoldDark];
      case 'disabled':
        return [colors.border, colors.borderLight, colors.border];
      default:
        return [colors.card, colors.surface, colors.card];
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'selected':
        return colors.barberGold;
      case 'disabled':
        return colors.border;
      default:
        return colors.borderLight;
    }
  };

  const CardContent = () => (
    <LinearGradient
      colors={getCardColors()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.5, 1]}
      style={[
        {
          borderRadius: 16,
          padding: 20,
          borderWidth: 2,
          borderColor: getBorderColor(),
          shadowColor: getBorderColor(),
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: variant === 'selected' ? 0.5 : 0.1,
          shadowRadius: variant === 'selected' ? 12 : 8,
          elevation: variant === 'selected' ? 10 : 4,
        },
        style,
      ]}
    >
      {(title || subtitle) && (
        <View style={{ marginBottom: children ? 16 : 0 }}>
          {title && (
            <Text
              style={[
                {
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: subtitle ? 4 : 0,
                },
                titleStyle,
              ]}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={[
                {
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: '400',
                },
                subtitleStyle,
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={variant === 'disabled'}
        style={{ opacity: variant === 'disabled' ? 0.6 : 1 }}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
}; 