import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

export const OfflineStatusChip = () => {
  const { isOffline, syncQueueCount, setSyncQueueCount } = useApp();

  const [syncState, setSyncState] = useState<'online' | 'offline' | 'syncing'>('online');
  const prevOfflineRef = useRef(isOffline);

  // Animation opacity for flashing/pulsing offline indicator
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation when offline
    let animationLoop: Animated.CompositeAnimation | null = null;
    if (isOffline) {
      animationLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      animationLoop.start();
    } else {
      flashAnim.setValue(1);
    }
    return () => animationLoop?.stop();
  }, [isOffline]);

  useEffect(() => {
    const prevOffline = prevOfflineRef.current;
    prevOfflineRef.current = isOffline;

    if (isOffline) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSyncState('offline');
    } else if (prevOffline && !isOffline) {
      // Transition from offline to online: show syncing status first
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSyncState('syncing');

      // After 2.5 seconds, set back to synced online
      const timer = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSyncState('online');
        setSyncQueueCount(0); // Reset SQLite queue count
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      setSyncState('online');
    }
  }, [isOffline]);

  if (syncState === 'offline') {
    return (
      <View style={[styles.container, styles.offlineBg]}>
        <Animated.View style={[styles.dot, styles.offlineDot, { opacity: flashAnim }]} />
        <Text style={[styles.text, styles.offlineText]}>
          Offline — {syncQueueCount} {syncQueueCount === 1 ? 'scan' : 'scans'} queued
        </Text>
      </View>
    );
  }

  if (syncState === 'syncing') {
    return (
      <View style={[styles.container, styles.syncingBg]}>
        <Ionicons name="sync-outline" size={12} color="#1E40AF" style={styles.spinIcon} />
        <Text style={[styles.text, styles.syncingText]}>
          Syncing SQLite Queue...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.onlineBg]}>
      <View style={[styles.dot, styles.onlineDot]} />
      <Text style={[styles.text, styles.onlineText]}>Online & Synced</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  onlineBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  onlineDot: {
    backgroundColor: COLORS.success,
  },
  onlineText: {
    color: COLORS.success,
  },
  offlineBg: {
    backgroundColor: 'rgba(245, 197, 24, 0.08)',
    borderColor: 'rgba(245, 197, 24, 0.2)',
  },
  offlineDot: {
    backgroundColor: COLORS.pending,
  },
  offlineText: {
    color: '#B8920A',
  },
  syncingBg: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  syncingText: {
    color: '#1D4ED8',
  },
  spinIcon: {
    marginRight: 4,
  },
});
