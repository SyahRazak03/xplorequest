import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { COLORS, TYPOGRAPHY, SPACING } from '../theme';
import { StarBurst, DashedRoutePath } from '../components';

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<SplashScreenNavigationProp>();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence of entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-advance after 1.8 seconds
    const timer = setTimeout(() => {
      handleNavigateNext();
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const handleNavigateNext = () => {
    navigation.replace('RoleSelect');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={handleNavigateNext}
      style={styles.container}
    >
      <LinearGradient
        // Field Journal gradient: deep purple-navy to cream
        colors={['#2B1A40', '#3D2270', '#5B3A9E']}
        style={styles.background}
      >
        {/* Decorative StarBurst flourishes */}
        <StarBurst size={40} color={COLORS.decorative.starBurst} opacity={0.6} style={styles.starTopRight} />
        <StarBurst size={24} color={COLORS.decorative.starBurst} opacity={0.4} style={styles.starBottomLeft} />
        <StarBurst size={32} color={COLORS.decorative.starBurst} opacity={0.35} style={styles.starMidLeft} />

        {/* Decorative Route Path */}
        <DashedRoutePath width={220} height={50} color="#FFFFFF" opacity={0.15} style={styles.routePath} />

        <Animated.View
          style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* App Icon Badge — circular frame showing the real XQ icon */}
          <View style={styles.logoBadge}>
            <Image
              source={require('../assets/XploreQuest_Icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* App Name — display font */}
          <Text style={styles.title}>XploreQuest</Text>
        </Animated.View>

        {/* Tagline & Presentation Footer */}
        <Animated.View style={[styles.footer, { opacity: textFadeAnim }]}>
          <Text style={styles.tagline}>Find your way. Own the race</Text>
          <Text style={styles.clientLabel}>
            Explorace Platform
          </Text>
          <View style={styles.tapPromptContainer}>
            <Text style={styles.tapPrompt}>Click to continue</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Decorative positions
  starTopRight: {
    position: 'absolute',
    top: 60,
    right: 28,
  },
  starBottomLeft: {
    position: 'absolute',
    bottom: 140,
    left: 32,
  },
  starMidLeft: {
    position: 'absolute',
    top: '38%',
    left: 18,
  },
  routePath: {
    position: 'absolute',
    bottom: 200,
    right: -20,
    transform: [{ rotate: '-15deg' }],
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  logoBadge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  logoImage: {
    width: 130,
    height: 130,
  },
  title: {
    fontSize: 48,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    color: COLORS.textLight,
    marginTop: SPACING.lg,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 6,
  },
  footer: {
    position: 'absolute',
    bottom: SPACING.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  tagline: {
    fontSize: TYPOGRAPHY.fontSize.h3,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.participant.accent,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  clientLabel: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: 'rgba(250, 249, 246, 0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },
  tapPromptContainer: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tapPrompt: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: 'rgba(250, 249, 246, 0.4)',
  },
});
