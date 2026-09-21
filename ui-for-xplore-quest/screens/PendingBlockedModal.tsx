import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkpoint } from '../types';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

const { width } = Dimensions.get('window');

interface PendingBlockedModalProps {
  visible: boolean;
  pendingCheckpoint: Checkpoint | null;
  onClose: () => void;
}

export default function PendingBlockedModal({
  visible,
  pendingCheckpoint,
  onClose,
}: PendingBlockedModalProps) {
  const theme = getThemeForRole('participant');

  if (!pendingCheckpoint) return null;

  // Extract checkpoint short code (e.g. CP3)
  const cpNumber = pendingCheckpoint.id.replace('CP-00', 'CP').replace('CP-0', 'CP');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            {/* Washi Tape Strip */}
            <View style={styles.washiTape} pointerEvents="none">
              <View style={styles.washiTapeInner} />
            </View>

            {/* Red Warning Alert Banner */}
            <View style={styles.header}>
              <View style={styles.warningBadge}>
                <Ionicons name="warning-outline" size={32} color={COLORS.danger} />
              </View>
              <Text style={styles.headerTitle}>AKSES DISEKAT!</Text>
              <Text style={styles.headerSubtitle}>Tugasan Belum Selesai</Text>
            </View>

            {/* Warning Message block */}
            <View style={styles.body}>
              <View style={styles.messageBox}>
                <Text style={styles.warningMessage}>
                  {`:: ANDA BELUM MELENGKAPKAN TUGASAN DI ${cpNumber.toUpperCase()} !!! ::`}
                </Text>
              </View>

              <Text style={styles.checkpointName}>
                {pendingCheckpoint.name}
              </Text>
              
              <Text style={styles.instructions}>
                Mengikut syarat rasmi acara, semua checkpoint mesti disahkan dan diselesaikan sebelum anda dibenarkan untuk mendaftar masuk di Garisan Penamat.
              </Text>

              {/* Box displaying the clue/task of the pending checkpoint */}
              <View style={styles.clueCard}>
                <View style={styles.clueHeader}>
                  <Ionicons name="bulb-outline" size={16} color={COLORS.participant.primary} />
                  <Text style={styles.clueTitle}>Tugasan Pos Kawalan:</Text>
                </View>
                <Text style={styles.clueText}>{pendingCheckpoint.taskDescription}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Kembali ke Checkpoint Tertunda</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 16, 46, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FAF9F6',
    borderRadius: RADIUS.lg,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    borderStyle: 'dashed',
    ...SHADOWS.lg,
    position: 'relative',
    alignItems: 'center',
  },
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
    backgroundColor: COLORS.decorative.starBurst,
    opacity: 0.85,
    borderRadius: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  warningBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 26,
    color: COLORS.danger,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  body: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  messageBox: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.xs,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.md,
    width: '100%',
    marginBottom: SPACING.md,
  },
  warningMessage: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  checkpointName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  instructions: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  clueCard: {
    backgroundColor: COLORS.admin.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginTop: SPACING.xs,
    width: '100%',
  },
  clueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  clueTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.participant.primary,
  },
  clueText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 17,
  },
  footer: {
    width: '100%',
    marginTop: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.participant.primary,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    gap: 8,
    ...SHADOWS.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
