/**
 * Card.tsx
 * Field Journal theme — "Taped journal page" card container.
 *
 * Visual changes:
 * - Dashed border instead of solid flat line (hand-drawn, not corporate)
 * - Yellow "washi tape" strip pinned across the top-left corner (like
 *   a clipping taped into a field journal)
 * - Title uses the display/script font (Caveat Bold) — short text stays legible
 * - Body/children remain in clean System sans-serif
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Text, StyleProp } from 'react-native';
import { getThemeForRole, UserRole, COLORS, TYPOGRAPHY } from '../theme';

interface CardProps {
  children: React.ReactNode;
  role?: UserRole;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderAccent?: 'none' | 'left' | 'top';
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  /** Set to false to suppress the washi tape decoration (e.g. admin tables) */
  washiTape?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  role = 'participant',
  style,
  contentStyle,
  borderAccent = 'none',
  title,
  subtitle,
  headerRight,
  washiTape = true,
}) => {
  const currentTheme = getThemeForRole(role);
  const { colors, radius, spacing, shadows, typography } = currentTheme;

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderColor: colors.border,
      borderWidth: 1.5,
      borderStyle: 'dashed' as const,
      ...shadows.sm,
    },
    borderAccent === 'left' && {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    borderAccent === 'top' && {
      borderTopWidth: 4,
      borderTopColor: colors.primary,
    },
    style,
  ];

  const hasHeader = title || subtitle || headerRight;
  const showWashi = washiTape && !!title; // only show tape when there's a title

  return (
    <View style={cardStyle}>
      {/* Washi tape strip — yellow strip pinned at the top-left corner */}
      {showWashi && (
        <View style={styles.washiTape} pointerEvents="none">
          <View style={styles.washiTapeInner} />
        </View>
      )}

      {hasHeader && (
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              borderBottomWidth: children ? 1 : 0,
              // Dashed bottom separator
              borderStyle: 'dashed',
              padding: spacing.md,
              // Extra left padding when tape is present so title clears the strip
              paddingLeft: showWashi ? spacing.md + 4 : spacing.md,
              paddingTop: showWashi ? spacing.md + 4 : spacing.md,
            },
          ]}
        >
          <View style={styles.headerTextContainer}>
            {title && (
              <Text
                style={[
                  styles.title,
                  {
                    // Script/display font for card titles — short text only
                    fontFamily: TYPOGRAPHY.fontFamily.display,
                    color: colors.textDisplay ?? COLORS.textDisplay,
                    fontSize: typography.fontSize.bodyLarge + 2,
                    fontWeight: typography.fontWeight.bold,
                  },
                ]}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  {
                    // Subtitle stays in clean sans-serif
                    fontFamily: TYPOGRAPHY.fontFamily.sans,
                    color: colors.textMuted,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.regular,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}
      <View style={[styles.content, { padding: spacing.md }, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'visible', // allow tape to overlap edge slightly
    position: 'relative',
  },
  // The washi tape "strip" — yellow rectangle rotated -4deg, pinned top-left
  washiTape: {
    position: 'absolute',
    top: -6,
    left: 12,
    zIndex: 10,
    transform: [{ rotate: '-3deg' }],
  },
  washiTapeInner: {
    width: 52,
    height: 14,
    backgroundColor: COLORS.decorative.starBurst, // notebook yellow
    opacity: 0.82,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    letterSpacing: 0.2,
  },
  subtitle: {
    letterSpacing: 0.1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'column',
  },
});
