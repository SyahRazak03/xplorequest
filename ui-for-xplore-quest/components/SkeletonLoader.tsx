import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme';

interface SkeletonLoaderProps {
  type: 'list' | 'card' | 'map';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const renderListSkeleton = () => {
    return (
      <View style={styles.listContainer}>
        {[1, 2, 3].map(item => (
          <Animated.View key={item} style={[styles.skeletonCard, { opacity: pulseAnim }]}>
            <View style={styles.cardHeader}>
              <View style={styles.iconPlaceholder} />
              <View style={styles.textWrapper}>
                <View style={styles.titlePlaceholder} />
                <View style={styles.subtitlePlaceholder} />
              </View>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.bodyLinePlaceholder} />
            <View style={[styles.bodyLinePlaceholder, { width: '60%' }]} />
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderCardSkeleton = () => {
    return (
      <Animated.View style={[styles.skeletonCard, { opacity: pulseAnim, padding: SPACING.lg }]}>
        <View style={[styles.titlePlaceholder, { width: '40%', height: 18 }]} />
        <View style={[styles.bodyLinePlaceholder, { marginTop: SPACING.md }]} />
        <View style={styles.bodyLinePlaceholder} />
        <View style={[styles.bodyLinePlaceholder, { width: '80%' }]} />
      </Animated.View>
    );
  };

  const renderMapSkeleton = () => {
    return (
      <Animated.View style={[styles.mapPlaceholder, { opacity: pulseAnim }]}>
        <View style={styles.mapInnerIcon} />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {type === 'list' && renderListSkeleton()}
      {type === 'card' && renderCardSkeleton()}
      {type === 'map' && renderMapSkeleton()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  listContainer: {
    gap: SPACING.md,
  },
  skeletonCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  textWrapper: {
    flex: 1,
    gap: 6,
  },
  titlePlaceholder: {
    width: '70%',
    height: 14,
    backgroundColor: COLORS.border,
    borderRadius: 4,
  },
  subtitlePlaceholder: {
    width: '40%',
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 4,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  bodyLinePlaceholder: {
    width: '100%',
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  mapPlaceholder: {
    width: '100%',
    height: 240,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  mapInnerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
});
