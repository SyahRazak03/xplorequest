import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { getThemeForRole, UserRole } from '../theme';

interface ProgressBarProps {
  progress: number; // Value between 0 and 100
  role?: UserRole;
  showLabel?: boolean;
  labelText?: string;
  style?: ViewStyle;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  role = 'participant',
  showLabel = false,
  labelText,
  style,
  height = 8,
}) => {
  const currentTheme = getThemeForRole(role);
  const { colors, radius, spacing, typography } = currentTheme;

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <View style={[styles.labelRow, { marginBottom: spacing.xs }]}>
          <Text
            style={[
              styles.labelText,
              {
                color: colors.text,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
              },
            ]}
          >
            {labelText || 'Kemajuan'}
          </Text>
          <Text
            style={[
              styles.percentageText,
              {
                color: colors.primary,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.bold,
              },
            ]}
          >
            {Math.round(clampedProgress)}%
          </Text>
        </View>
      )}
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.border,
            borderRadius: radius.full,
            height: height,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              width: `${clampedProgress}%`,
              height: height,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    letterSpacing: 0.1,
  },
  percentageText: {
    letterSpacing: 0.1,
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
