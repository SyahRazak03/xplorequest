import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { getThemeForRole, UserRole } from '../theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  role?: UserRole;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  role = 'participant',
  rightAction,
  style,
}) => {
  const currentTheme = getThemeForRole(role);
  const { colors, spacing, typography } = currentTheme;

  return (
    <View style={[styles.container, { marginBottom: spacing.md }, style]}>
      <View style={styles.leftContainer}>
        {/* Left vertical accent line */}
        <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: typography.fontSize.h3,
                fontWeight: typography.fontWeight.bold,
              },
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textMuted,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.regular,
                  marginTop: spacing.xs / 2,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  accentBar: {
    width: 4,
    height: '90%',
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
  },
  textContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  title: {
    letterSpacing: -0.1,
  },
  subtitle: {
    letterSpacing: 0.1,
  },
  rightAction: {
    marginLeft: 8,
    justifyContent: 'center',
  },
});
