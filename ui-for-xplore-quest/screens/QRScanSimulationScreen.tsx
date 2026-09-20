import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Animated,
  TouchableOpacity,
  Dimensions,
  Easing,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Checkpoint } from '../mockData';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { useApp } from '../AppContext';


const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const VIEWFINDER_SIZE = 260;

interface QRScanSimulationScreenProps {
  visible: boolean;
  checkpoint: Checkpoint | null;
  onClose: () => void;
  onScanSuccess: (cpId: string) => void;
}

type ScanStatus = 'scanning' | 'success';

export default function QRScanSimulationScreen({
  visible,
  checkpoint,
  onClose,
  onScanSuccess,
}: QRScanSimulationScreenProps) {
  const theme = getThemeForRole('participant');
  const { rules } = useApp();
  const [status, setStatus] = useState<ScanStatus>('scanning');


  // Animation values
  const laserAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0.4)).current;
  const successScale = useRef(new Animated.Value(0.3)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Timeout references
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Reset and run animations when visible changes
  useEffect(() => {
    if (visible) {
      setStatus('scanning');
      laserAnim.setValue(0);
      textOpacity.setValue(0.4);
      successScale.setValue(0.3);
      successOpacity.setValue(0);

      // Start laser looping animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: VIEWFINDER_SIZE - 6,
            duration: 1500,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 4,
            duration: 1500,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start text pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Automatic scan detection after 1.8 seconds
      timerRef.current = setTimeout(() => {
        triggerSuccess();
      }, 1800);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [visible]);

  // 2. Trigger success overlay and state change
  const triggerSuccess = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('success');

    // Run checkmark scale-up spring and fade-in animation
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto navigate back after 1.5 seconds of displaying verified status
    exitTimerRef.current = setTimeout(() => {
      if (checkpoint) {
        onScanSuccess(checkpoint.id);
      }
      onClose();
    }, 1500);
  };

  if (!visible) return null;

  const cpName = checkpoint ? checkpoint.name : 'Pos Kawalan';
  const cpPoints = checkpoint ? checkpoint.scorePoints : 100;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {status === 'scanning' ? (
          <>
            {/* Viewfinder Overlay Mask Panels (creates clear box in the middle) */}
            <View style={styles.maskTop} />
            <View style={styles.maskRow}>
              <View style={styles.maskSide} />
              <View style={styles.viewfinder}>
                {/* Looping Laser Line */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    {
                      transform: [{ translateY: laserAnim }],
                    },
                  ]}
                />
                {/* 4 Corner Brackets */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />

                {/* Subtle centering target dot */}
                <View style={styles.centerTarget} />
              </View>
              <View style={styles.maskSide} />
            </View>
            <View style={styles.maskBottom} />

            {/* Content & Action Text overlays */}
            <SafeAreaView style={styles.overlayContent}>
              {/* Header Bar */}
              <View style={styles.headerBar}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pengimbas Pintar</Text>
                <View style={styles.placeholder} />
              </View>

              {/* Status Info */}
              <View style={styles.infoBox}>
                <Text style={styles.scanTargetTitle}>Halakan Pada Kod QR</Text>
                <Text style={[styles.scanTargetSub, { color: theme.colors.primaryLight }]}>
                  {cpName}
                </Text>
                
                <Animated.Text style={[styles.pulseText, { opacity: textOpacity }]}>
                  ⚡ Menghubungkan isyarat GPS & mengimbas...
                </Animated.Text>
              </View>

              {/* Developer Dev Bypass Override Button */}
              {__DEV__ && (
                <View style={styles.bypassContainer}>
                  <TouchableOpacity
                    style={styles.bypassButton}
                    onPress={triggerSuccess}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="construct-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
                    <Text style={styles.bypassButtonText}>Pintas Imbasan (Dev)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          </>
        ) : (
          /* SUCCESS OVERLAY — Field Journal Stamp Card */
          <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]}>
            {/* Deep purple gradient overlay backdrop */}
            <LinearGradient
              colors={['rgba(43,26,64,0.96)', 'rgba(91,58,158,0.88)']}
              style={StyleSheet.absoluteFillObject}
            />

            <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>

              {/* Washi tape strip — decorative top-left corner */}
              <View style={styles.washiTape} pointerEvents="none">
                <View style={styles.washiTapeInner} />
              </View>

              {/* Stamp circle — deep purple ring with checkmark */}
              <View style={styles.stampRing}>
                <View style={styles.stampInner}>
                  <Ionicons name="checkmark" size={52} color="#FFFFFF" />
                </View>
                {/* Dashed outer ring — passport stamp detail */}
                <View style={styles.stampDashedRing} pointerEvents="none" />
              </View>

              {/* DISAHKAN! — display font header */}
              <Text style={styles.successTitle}>DISAHKAN!</Text>

              {/* Checkpoint name */}
              <View style={styles.cpNamePill}>
                <Ionicons name="location" size={13} color={COLORS.participant.primary} />
                <Text style={styles.successCpName}>{cpName}</Text>
              </View>

              {/* Points badge */}
              {rules.pointsSystemEnabled ? (
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsBadgeText}>+{cpPoints} Mata</Text>
                  <Text style={styles.pointsBadgeSub}>Diperolehi!</Text>
                </View>
              ) : (
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsBadgeText}>Pos Kawalan</Text>
                  <Text style={styles.pointsBadgeSub}>Berjaya Didaftar</Text>
                </View>
              )}

              {/* Divider rule */}
              <View style={styles.divider} />

              {/* Progress bar section */}
              <View style={styles.progressBarWrapper}>
                <View style={styles.progressLabelRow}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.progressText}>Menyimpan rekod ke blockchain...</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <Animated.View style={styles.progressBarFill} />
                </View>
              </View>

            </Animated.View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Translucent overlays
  maskTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: (screenHeight - VIEWFINDER_SIZE) / 2,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
  },
  maskBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: (screenHeight - VIEWFINDER_SIZE) / 2,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
  },
  maskRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
    position: 'absolute',
    top: (screenHeight - VIEWFINDER_SIZE) / 2,
    left: 0,
    right: 0,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  // Laser styling
  laserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: '#10B981',
    borderRadius: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  // Custom Corner Bracket borders
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: RADIUS.xs,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: RADIUS.xs,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: RADIUS.xs,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: RADIUS.xs,
  },
  centerTarget: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  // Overlay Content Layout
  overlayContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    marginTop: 10,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 32,
  },
  infoBox: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.15,
  },
  scanTargetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  scanTargetSub: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  pulseText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 16,
    fontWeight: '500',
  },
  bypassContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bypassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
  },
  bypassButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // Success Overlay Styles — Field Journal theme
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    // Cream notebook-paper card
    backgroundColor: '#FAF9F6',
    borderRadius: 24,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    // Dashed border — Field Journal style
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    borderStyle: 'dashed',
    // Strong shadow
    shadowColor: '#2B1A40',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
    overflow: 'visible',
    position: 'relative',
  },

  // Washi tape decoration
  washiTape: {
    position: 'absolute',
    top: -8,
    left: 20,
    transform: [{ rotate: '-3deg' }],
    zIndex: 10,
  },
  washiTapeInner: {
    width: 64,
    height: 16,
    backgroundColor: COLORS.decorative.starBurst, // notebook yellow
    opacity: 0.85,
    borderRadius: 3,
  },

  // Stamp circle — outer ring
  stampRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.participant.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
    // Glow
    shadowColor: COLORS.participant.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  stampInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dashed outer ring (passport stamp)
  stampDashedRing: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },

  // DISAHKAN! title
  successTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.display,
    fontSize: 36,
    color: COLORS.participant.primary,
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },

  // Checkpoint name pill
  cpNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.admin.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  successCpName: {
    color: COLORS.participant.primary,
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },

  // Points badge
  pointsBadge: {
    backgroundColor: COLORS.crew.primary, // coral
    borderRadius: RADIUS.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.crew.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pointsBadgeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.5,
  },
  pointsBadgeSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    letterSpacing: 0.3,
  },

  // Divider
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },

  // Progress bar
  progressBarWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '80%',
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
});
