import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS } from '../theme';

export interface ToastNotificationProps {
  visible: boolean;

  message: string;
  type: 'success' | 'warning' | 'info' | 'danger' | 'error';
  onDismiss: () => void;

  duration?: number;
}

const { width } = Dimensions.get('window');

export function ToastNotification({
  visible,
  message,
  type,
  onDismiss,
  duration = 3000,
}: ToastNotificationProps) {
  const theme = getThemeForRole('participant');
  const slideAnim = useRef(new Animated.Value(100)).current; // Start hidden below screen

  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Set dismiss timeout
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(100);
    }
  }, [visible, message]);

  const hideToast = () => {
    Animated.timing(slideAnim, {
      toValue: 150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  let bgColor = theme.colors.primary;
  let iconName: keyof typeof Ionicons.glyphMap = 'information-circle';

  if (type === 'success') {
    bgColor = COLORS.success;
    iconName = 'checkmark-circle';
  } else if (type === 'warning') {
    bgColor = COLORS.warning;
    iconName = 'alert-circle';
  } else if (type === 'danger' || type === 'error') {
    bgColor = COLORS.danger;
    iconName = 'close-circle';
  }


  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          transform: [{ translateY: slideAnim }],
          borderRadius: theme.radius.full,
          ...theme.shadows.lg,
        },
      ]}
    >
      <Ionicons name={iconName} size={20} color="#FFFFFF" />
      <Text style={styles.messageText}>{message}</Text>
      <Ionicons
        name="close"
        size={16}
        color="rgba(255,255,255,0.7)"
        onPress={hideToast}
        style={styles.closeIcon}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Positioned safely above bottom tab navigation
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  closeIcon: {
    paddingLeft: 8,
  },
});
