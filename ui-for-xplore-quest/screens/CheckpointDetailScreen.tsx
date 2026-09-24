import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkpoint, CheckpointStatus } from '../types';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS } from '../theme';
import { Badge } from '../components/Badge';
import { useApp } from '../AppContext';

interface CheckpointDetailScreenProps {
  visible: boolean;
  checkpoint: Checkpoint | null;
  status: CheckpointStatus;
  index: number;
  onClose: () => void;
  /**
   * State Machine Actions:
   * 1. Skip: (active) => transition to (pending)
   * 2. Complete: (active or pending) => transition to (completed)
   */
  onSkip: (cpId: string) => void;
  onScanQR: (cpId: string) => void;
}

export default function CheckpointDetailScreen({
  visible,
  checkpoint,
  status,
  index,
  onClose,
  onSkip,
  onScanQR,
}: CheckpointDetailScreenProps) {
  const theme = getThemeForRole('participant');
  const { rules } = useApp();

  if (!checkpoint) return null;

  const isCompleted = status === 'completed';
  const isSkipped = status === 'pending'; // 'pending' status internally maps to the skipped checkpoint
  const isActive = status === 'active';
  const isLocked = status === 'locked';

  // State mapping for badges
  let statusBadgeLabel = 'Locked 🔒';
  let statusBadgeState: 'success' | 'warning' | 'danger' | 'info' = 'danger';

  if (isCompleted) {
    statusBadgeLabel = 'Completed ✅';
    statusBadgeState = 'success';
  } else if (isSkipped) {
    statusBadgeLabel = 'Pending ⚠️';
    statusBadgeState = 'warning';
  } else if (isActive) {
    statusBadgeLabel = 'Active Now ▶️';
    statusBadgeState = 'info';
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        {/* Navigation/Header Bar */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Checkpoint Details
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Info Card */}
          <View style={[styles.mainCard, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, ...theme.shadows.sm }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.checkpointSub, { color: theme.colors.textMuted }]}>
                  CHECKPOINT {index + 1}
                </Text>
                <Text style={[styles.checkpointTitle, { color: theme.colors.text }]}>
                  {checkpoint.name}
                </Text>
              </View>
            </View>

            {/* Badges Row */}
            <View style={styles.badgeContainer}>
              <Badge label={statusBadgeLabel} state={statusBadgeState} />
              {rules.pointsSystemEnabled && (
                <Badge label={`+${checkpoint.scorePoints} Points`} state={isCompleted ? 'success' : 'info'} />
              )}
            </View>
          </View>


          {/* Clue Visual Landmark Frame */}
          <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
            Location Landmark
          </Text>
          <View style={[styles.imageFrame, { borderRadius: theme.radius.md, borderColor: theme.colors.border }]}>
            {isLocked ? (
              <View style={styles.lockedVisualOverlay}>
                <Ionicons name="lock-closed" size={54} color={theme.colors.textMuted} />
                <Text style={[styles.lockedText, { color: theme.colors.textMuted }]}>
                  Clue Map Locked
                </Text>
                <Text style={[styles.lockedDesc, { color: theme.colors.textMuted }]}>
                  Complete active checkpoint first to reveal landmark photo.
                </Text>
              </View>
            ) : checkpoint.imageUrl && checkpoint.imageUrl.trim() !== '' ? (
              <Image
                source={{ uri: checkpoint.imageUrl }}
                style={styles.landmarkImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.lockedVisualOverlay, { backgroundColor: '#F8FAFC' }]}>
                <Ionicons name="image-outline" size={48} color={theme.colors.textMuted} />
                <Text style={[styles.lockedText, { color: theme.colors.textMuted, fontSize: 13, marginTop: 6 }]}>
                  No Landmark Photo
                </Text>
                <Text style={[styles.lockedDesc, { color: theme.colors.textMuted, fontSize: 11 }]}>
                  Organizer has not uploaded a photo for this checkpoint. Please refer to clues below.
                </Text>
              </View>
            )}
          </View>

          {/* Location Clue Riddle Card */}
          {!isLocked && (
            <View style={[styles.detailsCard, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, ...theme.shadows.sm }]}>
              <View style={styles.detailItem}>
                <View style={styles.detailItemHeader}>
                  <Ionicons name="bulb" size={20} color={theme.colors.accent} />
                  <Text style={[styles.detailItemTitle, { color: theme.colors.accent }]}>
                    Location Clue
                  </Text>
                </View>
                <Text style={[styles.detailItemDesc, { color: theme.colors.text }]}>
                  {checkpoint.clueText}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.detailItem}>
                <View style={styles.detailItemHeader}>
                  <Ionicons name="clipboard" size={20} color={theme.colors.primary} />
                  <Text style={[styles.detailItemTitle, { color: theme.colors.primary }]}>
                    Checkpoint Task
                  </Text>
                </View>
                <Text style={[styles.detailItemDesc, { color: theme.colors.text }]}>
                  {checkpoint.taskDescription}
                </Text>
              </View>
            </View>
          )}

          {/* Locked State Warning Banner */}
          {isLocked && (
            <View style={[styles.lockedBanner, { backgroundColor: '#F1F5F9', borderRadius: theme.radius.sm }]}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.textMuted} />
              <Text style={[styles.lockedBannerText, { color: theme.colors.textMuted }]}>
                This event operates sequentially. Please follow your assigned route map to active checkpoints.
              </Text>
            </View>
          )}

          {/* Completed State Success Banner */}
          {isCompleted && (
            <View style={[styles.successBanner, { backgroundColor: '#ECFDF5', borderColor: '#10B981', borderRadius: theme.radius.sm }]}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <Text style={styles.successBannerText}>
                Congratulations! Your team completed this checkpoint and earned points!
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action Button Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          {(isActive || isSkipped) && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}
              onPress={() => {
                onClose();
                // Execute scanner logic in parent after small UI animation delay
                setTimeout(() => {
                  onScanQR(checkpoint.id);
                }, 300);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {isSkipped ? 'Return & Scan Marshal QR' : 'Scan Marshal QR Code'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 
            STATE MACHINE: Skip Checkpoint Logic (congestion avoidance)
            Transitions the checkpoint state from 'active' to 'pending' (⚠️).
            Automatically triggers the next sequential checkpoint to unlock.
          */}
          {isActive && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: COLORS.danger, borderRadius: theme.radius.sm }]}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  onSkip(checkpoint.id);
                }, 300);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-redo-outline" size={18} color={COLORS.danger} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.danger }]}>
                Skip Checkpoint (Congested)
              </Text>
            </TouchableOpacity>
          )}

          {isCompleted && (
            <TouchableOpacity
              style={[styles.closeButtonAction, { borderColor: theme.colors.border, borderRadius: theme.radius.sm }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.closeButtonActionText, { color: theme.colors.text }]}>
                Return to Dashboard
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightPlaceholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  mainCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8E4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  checkpointSub: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  checkpointTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  imageFrame: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  landmarkImage: {
    width: '100%',
    height: '100%',
  },
  lockedVisualOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  lockedDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  detailsCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8E4',
    gap: 12,
  },
  detailItem: {
    gap: 4,
  },
  detailItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailItemDesc: {
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 26,
  },
  divider: {
    height: 1,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  lockedBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  successBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    ...SHADOWS.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontWeight: '700',
    fontSize: 13,
  },
  closeButtonAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
  },
  closeButtonActionText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
