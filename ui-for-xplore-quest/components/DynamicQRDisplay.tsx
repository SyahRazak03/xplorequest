import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Easing,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DynamicQRDisplayProps {
  value: string;
  duration?: number; // Duration in seconds, default 30
  size?: number; // Size of QR code, default 180
  onExpire?: () => void;
  onRefresh?: () => void;
}

export const DynamicQRDisplay: React.FC<DynamicQRDisplayProps> = ({
  value,
  duration = 30,
  size = 180,
  onExpire,
  onRefresh,
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isExpired, setIsExpired] = useState(false);
  const animatedValue = useRef(new Animated.Value(1)).current;

  // Circle dimensions
  const strokeWidth = 6;
  const radius = size / 2 + 16;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Reset state
    setTimeLeft(duration);
    setIsExpired(false);
    animatedValue.setValue(1);

    // 1. Animated countdown ring
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: duration * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    // 2. Local countdown interval
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      animatedValue.stopAnimation();
    };
  }, [value, duration]);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // Interpolate animated value to dashOffset
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.qrWrapper, { width: size + 40, height: size + 40 }]}>
        {/* Animated Countdown SVG Ring */}
        <Svg
          style={styles.svgRing}
          width={radius * 2 + strokeWidth}
          height={radius * 2 + strokeWidth}
          viewBox={`0 0 ${radius * 2 + strokeWidth} ${radius * 2 + strokeWidth}`}
        >
          {/* Background circle */}
          <Circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            stroke={isExpired ? COLORS.border : COLORS.crew.primaryLight}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated active circle */}
          {!isExpired && (
            <AnimatedCircle
              cx={radius + strokeWidth / 2}
              cy={radius + strokeWidth / 2}
              r={radius}
              stroke={COLORS.crew.primary}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${radius + strokeWidth / 2} ${radius + strokeWidth / 2})`}
            />
          )}
        </Svg>

        {/* QR Code Container */}
        <View style={[styles.qrContainer, { width: size, height: size }, isExpired && styles.qrExpired]}>
          <QRCode
            value={value}
            size={size}
            color={isExpired ? COLORS.textMuted : COLORS.text}
            backgroundColor={COLORS.card}
          />

          {/* Expired Overlay */}
          {isExpired && (
            <View style={styles.expiredOverlay}>
              <View style={styles.expiredIconWrapper}>
                <Ionicons name="alert-circle" size={32} color={COLORS.danger} />
              </View>
              <Text style={styles.expiredText}>Kod Tamat Tempoh</Text>
              <Text style={styles.expiredSubtext}>Sila jana kod baru</Text>
            </View>
          )}
        </View>
      </View>

      {/* Countdown Timer or Refresh Action */}
      <View style={styles.footerContainer}>
        {isExpired ? (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.textLight} />
            <Text style={styles.refreshButtonText}>Jana Semula QR Kod</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={16} color={COLORS.crew.primary} />
            <Text style={styles.timerText}>Tamat dalam {timeLeft}s</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgRing: {
    position: 'absolute',
    zIndex: 1,
  },
  qrContainer: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrExpired: {
    opacity: 0.25,
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    padding: SPACING.md,
  },
  expiredIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  expiredText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.danger,
    textAlign: 'center',
  },
  expiredSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.crew.primaryLight,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  timerText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.crew.primary,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.crew.primary,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  refreshButtonText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
