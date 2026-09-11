import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { getThemeForRole, UserRole } from '../theme';

interface AvatarProps {
  initials?: string;
  source?: { uri: string } | number;
  role?: UserRole;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  initials,
  source,
  role = 'participant',
  size = 'md',
  style,
}) => {
  const currentTheme = getThemeForRole(role);
  const { colors, radius, typography } = currentTheme;

  // Determine pixel size
  let pixelSize = 40;
  let fontSize = typography.fontSize.body;

  switch (size) {
    case 'sm':
      pixelSize = 32;
      fontSize = typography.fontSize.caption;
      break;
    case 'lg':
      pixelSize = 56;
      fontSize = typography.fontSize.h3;
      break;
    case 'xl':
      pixelSize = 80;
      fontSize = typography.fontSize.h1 - 4;
      break;
    case 'md':
    default:
      pixelSize = 44;
      fontSize = typography.fontSize.bodyLarge;
      break;
  }

  const containerStyle = [
    styles.container,
    {
      width: pixelSize,
      height: pixelSize,
      borderRadius: pixelSize / 2,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    style,
  ];

  const initialsStyle = [
    styles.initials,
    {
      color: colors.primary,
      fontSize: fontSize,
      fontWeight: typography.fontWeight.bold,
    },
  ];

  return (
    <View style={containerStyle}>
      {source ? (
        <Image
          source={source}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: (pixelSize - 4) / 2,
          }}
        />
      ) : (
        <Text style={initialsStyle}>
          {initials ? initials.slice(0, 2).toUpperCase() : '??'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    textAlign: 'center',
  },
});
