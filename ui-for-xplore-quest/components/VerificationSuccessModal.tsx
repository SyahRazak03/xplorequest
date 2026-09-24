import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../theme';

const { width: screenWidth } = Dimensions.get('window');

interface VerificationSuccessModalProps {
  visible: boolean;
  checkpointName: string;
  pointsEarned: number;
  onClose: () => void;
}

export default function VerificationSuccessModal({
  visible,
  checkpointName,
  pointsEarned,
  onClose,
}: VerificationSuccessModalProps) {
  const successScale = useRef(new Animated.Value(0.7)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      successScale.setValue(0.7);
      progressAnim.setValue(0);

      // Bounce-in card animation
      Animated.spring(successScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }).start();

      // Smooth progress bar animation over 2 seconds
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }).start();

      // Auto close after 2.6 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 2600);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Deep purple gradient backdrop */}
        <LinearGradient
          colors={['rgba(43,26,64,0.94)', 'rgba(91,58,158,0.86)']}
          style={StyleSheet.absoluteFillObject}
        />

        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdropTouch}
          onPress={onClose}
        >
          <Animated.View
            style={[styles.card, { transform: [{ scale: successScale }] }]}
          >
            {/* Washi tape strip — decorative top edge */}
            <View style={styles.washiTape} pointerEvents="none">
              <View style={styles.washiTapeInner} />
            </View>

            {/* Stamp circle — green circle with checkmark & dashed ring */}
            <View style={styles.stampRing}>
              <View style={styles.stampInner}>
                <Ionicons name="checkmark" size={50} color="#FFFFFF" />
              </View>
              <View style={styles.stampDashedRing} pointerEvents="none" />
            </View>

            {/* VERIFIED! Header */}
            <Text style={styles.successTitle}>VERIFIED!</Text>

            {/* Checkpoint Location Chip */}
            <View style={styles.cpNamePill}>
              <Ionicons name="location" size={14} color={COLORS.participant.primary} />
              <Text style={styles.successCpName} numberOfLines={1}>
                {checkpointName || 'Checkpoint'}
              </Text>
            </View>

            {/* Dynamic Points Pill Badge */}
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>+{pointsEarned} Pts</Text>
              <Text style={styles.pointsBadgeSub}>Earned!</Text>
            </View>

            {/* Divider rule */}
            <View style={styles.divider} />

            {/* Progress bar section */}
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressLabelRow}>
                <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.progressText}>Saving record...</Text>
              </View>
              <View style={styles.progressBarBg}>
                <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
              </View>
            </View>

          </Animated.View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: screenWidth * 0.86,
    maxWidth: 360,
    backgroundColor: '#FAF7FD',
    borderRadius: 28,
    paddingHorizontal: SPACING.xl,
    paddingTop: 36,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    position: 'relative',
  },
  washiTape: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    width: 84,
    height: 22,
    backgroundColor: '#FACC15',
    borderRadius: 3,
    transform: [{ rotate: '-1deg' }],
    opacity: 0.95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  washiTapeInner: {
    width: '85%',
    height: '60%',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(180, 130, 0, 0.4)',
    borderRadius: 2,
  },
  stampRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(91, 58, 158, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  stampInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  stampDashedRing: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 48,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#7C3AED',
    opacity: 0.7,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4C1D95',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs + 2,
    fontStyle: 'italic',
  },
  cpNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
    marginBottom: SPACING.md,
    maxWidth: '90%',
  },
  successCpName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B3A9E',
  },
  pointsBadge: {
    backgroundColor: '#F43F5E',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  pointsBadgeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pointsBadgeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: -2,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: SPACING.sm,
  },
  progressBarWrapper: {
    width: '100%',
    gap: 6,
    marginTop: SPACING.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  progressBarBg: {
    width: '100%',
    height: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.07)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: RADIUS.full,
  },
});
