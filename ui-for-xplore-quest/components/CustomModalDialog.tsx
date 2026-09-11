/**
 * CustomModalDialog.tsx
 * Custom Field Journal themed Modal Dialog component to replace system Alert.alert() popups.
 * 
 * Supports:
 * - Title, Subtitle / Description
 * - Dynamic Icon & Accent Colors (Success, Warning, Danger, Info, Confirm)
 * - Washi Tape decoration & Field Journal dashed notebook card styling
 * - Primary & Secondary Action buttons
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

export type DialogVariant = 'confirm' | 'danger' | 'success' | 'warning' | 'info';

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomModalDialogProps {
  visible: boolean;
  title: string;
  message: string;
  variant?: DialogVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  buttons?: DialogButton[];
  onDismiss?: () => void;
}

export function CustomModalDialog({
  visible,
  title,
  message,
  variant = 'confirm',
  icon,
  buttons = [{ text: 'OK', style: 'default' }],
  onDismiss,
}: CustomModalDialogProps) {
  if (!visible) return null;

  // Resolve Variant Colors & Default Icons
  const getVariantDetails = () => {
    switch (variant) {
      case 'danger':
      case 'destructive' as any:
        return {
          icon: icon || 'alert-circle',
          badgeBg: 'rgba(239, 68, 68, 0.12)',
          iconColor: COLORS.danger,
          btnBg: COLORS.danger,
          btnTextColor: '#FFFFFF',
        };
      case 'success':
        return {
          icon: icon || 'checkmark-circle',
          badgeBg: 'rgba(16, 185, 129, 0.12)',
          iconColor: COLORS.success,
          btnBg: COLORS.success,
          btnTextColor: '#FFFFFF',
        };
      case 'warning':
        return {
          icon: icon || 'warning',
          badgeBg: 'rgba(245, 158, 11, 0.12)',
          iconColor: COLORS.warning,
          btnBg: COLORS.warning,
          btnTextColor: '#FFFFFF',
        };
      case 'info':
        return {
          icon: icon || 'information-circle',
          badgeBg: COLORS.admin.primaryLight,
          iconColor: COLORS.admin.primary,
          btnBg: COLORS.admin.primary,
          btnTextColor: '#FFFFFF',
        };
      case 'confirm':
      default:
        return {
          icon: icon || 'help-circle',
          badgeBg: COLORS.participant.primaryLight,
          iconColor: COLORS.participant.primary,
          btnBg: COLORS.participant.primary,
          btnTextColor: '#FFFFFF',
        };
    }
  };

  const details = getVariantDetails();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialogCard}>

              {/* Washi Tape Strip Decoration */}
              <View style={styles.washiTape} pointerEvents="none">
                <View style={styles.washiTapeInner} />
              </View>

              {/* Icon Badge */}
              <View style={[styles.iconBadge, { backgroundColor: details.badgeBg }]}>
                <Ionicons name={details.icon} size={36} color={details.iconColor} />
              </View>

              {/* Header Title */}
              <Text style={styles.titleText}>{title}</Text>

              {/* Description Body */}
              <Text style={styles.messageText}>{message}</Text>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Buttons Container */}
              <View style={[
                styles.buttonsContainer,
                buttons.length > 2 && { flexDirection: 'column' }
              ]}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  const buttonBg = isCancel
                    ? 'transparent'
                    : isDestructive
                    ? COLORS.danger
                    : details.btnBg;

                  const buttonTextColor = isCancel
                    ? COLORS.textMuted
                    : isDestructive
                    ? '#FFFFFF'
                    : details.btnTextColor;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        { backgroundColor: buttonBg },
                        isCancel && styles.cancelButton,
                        buttons.length === 2 && { flex: 1 },
                      ]}
                      onPress={() => {
                        if (btn.onPress) btn.onPress();
                        if (onDismiss) onDismiss();
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.buttonText, { color: buttonTextColor }]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 16, 46, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FAF9F6', // Field Journal Cream
    borderRadius: RADIUS.lg,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    borderStyle: 'dashed',
    ...SHADOWS.md,
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
    width: 56,
    height: 14,
    backgroundColor: COLORS.decorative.starBurst, // Notebook yellow
    opacity: 0.85,
    borderRadius: 3,
  },

  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleText: {
    fontSize: 19,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: TYPOGRAPHY.fontFamily.sans,
  },
  messageText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 4,
    marginBottom: SPACING.md,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.3,
  },
});
