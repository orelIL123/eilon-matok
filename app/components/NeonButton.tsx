import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../constants/colors';

interface NeonButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}) => {
  const getGradientColors = (): [string, string, string] => {
    switch (variant) {
      case 'secondary':
        return [colors.neonPurple, colors.neonPink, colors.neonPurple];
      case 'success':
        return [colors.barberGoldLight, colors.barberGold, colors.barberGoldDark];
      case 'warning':
        return [colors.warning, colors.neonPink, colors.warning];
      default:
        return [colors.barberGoldLight, colors.barberGold, colors.barberGoldDeep];
    }
  };

  const getTextColor = () => {
    return disabled ? colors.textMuted : colors.text;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          borderRadius: 12,
          overflow: 'hidden',
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.5, 1]}
        style={{
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: getGradientColors()[1],
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.7,
          shadowRadius: 20,
          elevation: 15,
        }}
      >
        <Text
          style={[
            {
              color: getTextColor(),
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}; 