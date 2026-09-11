/**
 * SecondaryButton.tsx
 * Field Journal theme — "Hand-drawn outline" secondary action button.
 *
 * Visual: cream fill, dashed purple outline, slightly rounded corners —
 * reads hand-drawn / journal-sketch, not corporate.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';
import { getThemeForRole, COLORS, UserRole } from '../theme';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  role?: UserRole;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: TextStyle;
  variant?: 'solid' | 'outline';
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  label,
  onPress,
  role = 'participant',
  disabled = false,
  loading = false,
  icon,
  style,
  labelStyle,
  variant = 'solid',
}) => {
  const currentTheme = getThemeForRole(role);
  const { colors, radius, spacing, typography } = currentTheme;

  // Dashed purple outline — always the journal sketch colour
  const outlineColor = COLORS.participant.primary; // #5B3A9E deep purple

  const buttonStyle: StyleProp<ViewStyle> = [
    styles.button,
    {
      borderRadius: radius.lg, // softer than pill, more hand-drawn feel
      paddingVertical: spacing.md - 2,
      paddingHorizontal: spacing.lg,
      backgroundColor: disabled ? '#E5E0D6' : COLORS.background, // cream
      borderWidth: 1.5,
      borderColor: disabled ? '#C9C3BB' : outlineColor,
      borderStyle: disabled ? 'solid' : 'dashed',
    },
    style,
  ];

  const textStyle = [
    styles.label,
    {
      fontSize: typography.fontSize.button,
      fontWeight: typography.fontWeight.medium,
      color: disabled ? '#8A7F73' : outlineColor,
    },
    labelStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.72}
      style={buttonStyle}
    >
      {loading ? (
        <ActivityIndicator size="small" color={outlineColor} />
      ) : (
        <View style={styles.contentContainer}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={textStyle}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
