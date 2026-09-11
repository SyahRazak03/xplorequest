/**
 * PrimaryButton.tsx
 * Field Journal theme — "Passport Stamp" primary action button.
 *
 * Visual: coral fill, pill-shaped (radius.full), thin white dashed inset ring
 * that reads like a rubber stamp / checkpoint stamp metaphor.
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

interface PrimaryButtonProps {
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

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
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
  const { colors, spacing, typography, shadows } = currentTheme;

  // Primary always uses coral (crew.primary) for the "stamp" CTA —
  // independent of role so the scan/primary action is always high-visibility.
  const stampColor = COLORS.crew.primary; // #E8506B coral

  const isSolid = variant === 'solid';

  const outerButtonStyle: StyleProp<ViewStyle> = [
    styles.outerPill,
    {
      paddingVertical: spacing.md - 2,
      paddingHorizontal: spacing.lg,
      backgroundColor: isSolid ? stampColor : 'transparent',
      borderWidth: isSolid ? 0 : 1.5,
      borderColor: isSolid ? 'transparent' : stampColor,
      ...( isSolid ? shadows.md : {}),
    },
    disabled && styles.disabledButton,
    style,
  ];

  const textStyle = [
    styles.label,
    {
      fontSize: typography.fontSize.button,
      fontWeight: typography.fontWeight.semiBold,
      color: isSolid ? COLORS.textLight : stampColor,
    },
    disabled && styles.disabledLabel,
    labelStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={outerButtonStyle}
    >
      {/* Dashed inset ring — the "stamp impression" detail */}
      {isSolid && !disabled && (
        <View style={styles.dashedRing} pointerEvents="none" />
      )}

      {loading ? (
        <ActivityIndicator
          size="small"
          color={isSolid ? COLORS.textLight : stampColor}
        />
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
  outerPill: {
    // Pill shape
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  // Thin dashed inset ring — passport/rubber-stamp impression
  dashedRing: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 6,
    bottom: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderStyle: 'dashed',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  disabledButton: {
    backgroundColor: '#E5E0D6',
    borderColor: '#E5E0D6',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledLabel: {
    color: '#8A7F73',
  },
});
