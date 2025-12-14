import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, style, ...props }) => {
  return (
    <View
      style={[
        {
          backgroundColor: 'transparent',
          borderRadius: 8,
          borderWidth: 0,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}; 