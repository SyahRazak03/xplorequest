/**
 * GhostButton.tsx
 * Field Journal theme — "Quiet ghost" low-priority action button.
 *
 * Visual: transparent fill, thin solid warm-grey outline, muted grey label.
 * Used for low-priority actions like "Skip checkpoint" — present but not calling
 * attention to itself.
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
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../theme';

interface GhostButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: TextStyle;
}

export const GhostButton: React.FC<GhostButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
  labelStyle,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.6}
      style={[styles.button, disabled && styles.disabledButton, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.textMuted} />
      ) : (
        <View style={styles.contentContainer}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.label, disabled && styles.disabledLabel, labelStyle]}>
            {label}
          </Text>
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
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C9C3BB', // warm grey — quiet, not demanding
    borderStyle: 'solid',
  },
  disabledButton: {
    opacity: 0.45,
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
    fontSize: TYPOGRAPHY.fontSize.button,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textMuted, // warm grey, quiet
    letterSpacing: 0.1,
  },
  disabledLabel: {
    color: '#B0A89E',
  },
});
