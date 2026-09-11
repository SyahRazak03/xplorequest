import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { getThemeForRole } from '../theme';

export type BadgeState = 'success' | 'pending' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  state?: BadgeState;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  state = 'info',
  icon,
  style,
  textStyle,
  size = 'md',
}) => {
  const currentTheme = getThemeForRole('participant'); // base styles
  const { colors, radius, spacing, typography } = currentTheme;

  // Determine badge colors based on state
  let bgColor = colors.primaryLight;
  let textColor = colors.primary;

  switch (state) {
    case 'success':
      bgColor = '#E6F4EA'; // light green
      textColor = '#137333'; // dark green
      break;
    case 'pending':
      bgColor = '#FEF3C7'; // light amber/orange
      textColor = '#D97706'; // dark amber
      break;
    case 'warning':
      bgColor = '#FFF9DB'; // light yellow
      textColor = '#F59E0B'; // yellow/amber
      break;
    case 'danger':
      bgColor = '#FCE8E6'; // light red
      textColor = '#C5221F'; // dark red
      break;
    case 'info':
    default:
      bgColor = '#E8F0FE'; // light blue
      textColor = '#1A73E8'; // dark blue
      break;
  }

  const badgeStyle = [
    styles.badge,
    {
      backgroundColor: bgColor,
      borderRadius: radius.full,
      paddingVertical: size === 'sm' ? spacing.xs / 2 : spacing.xs,
      paddingHorizontal: size === 'sm' ? spacing.sm : spacing.md,
    },
    style,
  ];

  const labelStyle = [
    styles.label,
    {
      color: textColor,
      fontSize: size === 'sm' ? typography.fontSize.caption - 1 : typography.fontSize.caption,
      fontWeight: typography.fontWeight.semiBold,
    },
    textStyle,
  ];

  return (
    <View style={badgeStyle}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
