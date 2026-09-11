import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { StarBurst } from '../components';

const { width, height } = Dimensions.get('window');

interface CelebrationModalProps {
  visible: boolean;
  onViewResults: () => void;
}

// Design constant variables for confetti
const CONFETTI_COLORS = ['#FFD700', '#FF6347', '#FF4500', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'];
const NUM_PARTICLES = 45;

export default function CelebrationModal({
  visible,
  onViewResults,
}: CelebrationModalProps) {
  const theme = getThemeForRole('participant');

  // Animation values
  const trophyScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Confetti animation states
  const confettiAnims = useRef(
    Array.from({ length: NUM_PARTICLES }, () => ({
      y: new Animated.Value(-50),
      x: new Animated.Value(0),
      rotate: new Animated.Value(0),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 8 + 6,
      left: Math.random() * width,
      shape: Math.random() > 0.5 ? 'circle' : 'square',
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Trophy scale bounce animation
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.spring(trophyScale, {
            toValue: 1,
            tension: 40,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Trigger Confetti Rain falling animations
      confettiAnims.forEach((particle) => {
        // Reset values
        particle.y.setValue(-50);
        particle.x.setValue(0);
        particle.rotate.setValue(0);

        const delay = Math.random() * 2000;
        const duration = Math.random() * 3000 + 2500;

        // Animate down, sway X, and rotate
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(particle.y, {
                toValue: height + 50,
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
              Animated.timing(particle.x, {
                toValue: (Math.random() - 0.5) * 160,
                duration: duration,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(particle.rotate, {
                toValue: Math.random() * 360 * 3,
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
          ])
        ).start();
      });
    } else {
      // Reset values when closed
      trophyScale.setValue(0);
      contentOpacity.setValue(0);
      confettiAnims.forEach((particle) => {
        particle.y.setValue(-50);
        particle.x.setValue(0);
        particle.rotate.setValue(0);
      });
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Confetti Elements */}
        {visible &&
          confettiAnims.map((particle, index) => {
            const rotation = particle.rotate.interpolate({
              inputRange: [0, 360],
              outputRange: ['0deg', '360deg'],
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.confetti,
                  {
                    left: particle.left,
                    backgroundColor: particle.color,
                    width: particle.size,
                    height: particle.shape === 'circle' ? particle.size : particle.size * 1.5,
                    borderRadius: particle.shape === 'circle' ? particle.size / 2 : 2,
                    transform: [
                      { translateY: particle.y },
                      { translateX: particle.x },
                      { rotate: rotation },
                    ],
                  },
                ]}
              />
            );
          })}

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            {/* Animated Trophy Icon Container */}
            <Animated.View style={[styles.trophyWrapper, { transform: [{ scale: trophyScale }] }]}>
              <View style={styles.glowCircle} />
              <View style={styles.trophyOuterBg}>
                <Ionicons name="trophy" size={80} color="#FFD700" />
              </View>
            </Animated.View>

            {/* Message Block */}
            <Animated.View style={[styles.textBlock, { opacity: contentOpacity }]}>
              <Text style={styles.congratsTitle}>TAHNIAH!</Text>
              
              <View style={styles.pillContainer}>
                <Text style={styles.pillText}>Semua Checkpoint Selesai</Text>
              </View>

              <Text style={styles.malayMessage}>
                TAHNIAH, ANDA BOLEH TERUS KE GARISAN PENAMAT 🥳🥳🥳
              </Text>

              <Text style={styles.englishMessage}>
                Congratulations, you have unlocked the final gateway. Walk across the line to finalize your records.
              </Text>
            </Animated.View>

            {/* Navigation Button to Personal Results Screen */}
            <Animated.View style={[styles.footer, { opacity: contentOpacity }]}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md },
                ]}
                onPress={onViewResults}
                activeOpacity={0.9}
              >
                <Text style={styles.actionButtonText}>Lihat Keputusan Penamat</Text>
                <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 26, 64, 0.96)', // Deep purple-navy Field Journal overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetti: {
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    zIndex: 10,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  trophyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  glowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
  },
  trophyOuterBg: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...SHADOWS.lg,
  },
  textBlock: {
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.xxl,
  },
  congratsTitle: {
    fontSize: 42,
    fontWeight: '900',
    fontFamily: TYPOGRAPHY.fontFamily.display,
    color: COLORS.decorative.starBurst,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pillContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  malayMessage: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  englishMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
  footer: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
  },
  actionButton: {
    width: '100%',
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
