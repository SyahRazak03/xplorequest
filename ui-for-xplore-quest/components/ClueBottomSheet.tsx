import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkpoint, CheckpointStatus } from '../mockData';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS } from '../theme';
import { Badge } from './Badge';
import { useApp } from '../AppContext';

interface ClueBottomSheetProps {
  visible: boolean;
  checkpoint: Checkpoint | null;
  status: CheckpointStatus;
  index: number;
  onClose: () => void;
  onPressScan?: () => void;
  onPressDetail?: () => void;
}

export const ClueBottomSheet: React.FC<ClueBottomSheetProps> = ({
  visible,
  checkpoint,
  status,
  index,
  onClose,
  onPressScan,
  onPressDetail,
}) => {
  const theme = getThemeForRole('participant');
  const { rules } = useApp();


  if (!checkpoint) return null;

  const isCompleted = status === 'completed';
  const isSkipped = status === 'pending'; // In our logic, 'pending' status indicates skipped
  const isActive = status === 'active';
  const isLocked = status === 'locked';

  let badgeLabel = 'Terkunci 🔒';
  let badgeState: 'success' | 'warning' | 'danger' | 'info' = 'danger';

  if (isCompleted) {
    badgeLabel = 'Selesai ✅';
    badgeState = 'success';
  } else if (isSkipped) {
    badgeLabel = 'Dilangkau ⚠️';
    badgeState = 'warning';
  } else if (isActive) {
    badgeLabel = 'Aktif Sini ▶️';
    badgeState = 'info';
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg }]}>
              <View>
                {/* Drag Indicator handle */}
                <View style={styles.dragHandle} />

                {/* Header Row */}
                <View style={styles.header}>
                  <View style={styles.titleArea}>
                    <Text style={[styles.cpNumber, { color: theme.colors.textMuted }]}>
                      CHECKPOINT {index + 1}
                    </Text>
                    <Text style={[styles.cpName, { color: theme.colors.text }]} numberOfLines={1}>
                      {checkpoint.name}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                    <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Status and Points row */}
                <View style={styles.statusRow}>
                  <Badge label={badgeLabel} state={badgeState} />
                  {rules.pointsSystemEnabled && (
                    <Badge label={`${checkpoint.scorePoints} Mata`} state={isCompleted ? 'success' : 'info'} />
                  )}
                </View>


                {/* Clue Visual Illustration */}
                <View style={[styles.imageContainer, { borderRadius: theme.radius.md, borderColor: theme.colors.border }]}>
                  {isLocked ? (
                    <View style={styles.lockedOverlay}>
                      <Ionicons name="lock-closed" size={48} color={theme.colors.textMuted} />
                      <Text style={[styles.lockedText, { color: theme.colors.textMuted }]}>
                        Selesaikan checkpoint sebelum ini untuk membuka petunjuk.
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={require('../assets/clue_landmark.png')}
                      style={styles.clueImage}
                      resizeMode="cover"
                    />
                  )}
                </View>

                {/* Clue Details Content */}
                <View style={styles.content}>
                  {!isLocked && (
                    <>
                      <View style={styles.infoSection}>
                        <View style={styles.sectionHeaderRow}>
                          <Ionicons name="bulb-outline" size={18} color={theme.colors.accent} />
                          <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>
                            Petunjuk Lokasi (Clue)
                          </Text>
                        </View>
                        <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
                          {checkpoint.clueText}
                        </Text>
                      </View>

                      <View style={styles.infoSection}>
                        <View style={styles.sectionHeaderRow}>
                          <Ionicons name="checkbox-outline" size={18} color={theme.colors.primary} />
                          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                            Tugasan di Checkpoint
                          </Text>
                        </View>
                        <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
                          {checkpoint.taskDescription}
                        </Text>
                      </View>
                    </>
                  )}

                  {isLocked && (
                    <View style={styles.lockedMessageArea}>
                      <Ionicons name="information-circle-outline" size={20} color={theme.colors.textMuted} />
                      <Text style={[styles.lockedSubText, { color: theme.colors.textMuted }]}>
                        Gunakan Peta Interaktif untuk navigasi ke checkpoint semasa terlebih dahulu.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bottom Buttons */}
                <View style={styles.footer}>
                  {isActive && onPressScan && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}
                      onPress={() => {
                        onClose();
                        // Delay execution slightly to allow modal to hide smoothly
                        setTimeout(() => {
                          onPressScan();
                        }, 300);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>Imbas QR Marshal Bertugas</Text>
                    </TouchableOpacity>
                  )}

                  {!isLocked && onPressDetail && (
                    <TouchableOpacity
                      style={[
                        styles.secondaryActionBtn,
                        { 
                          borderColor: theme.colors.primary, 
                          borderWidth: 1.5, 
                          borderRadius: theme.radius.sm,
                          marginTop: isActive ? 8 : 0 
                        }
                      ]}
                      onPress={() => {
                        onClose();
                        setTimeout(() => {
                          onPressDetail();
                        }, 300);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                      <Text style={[styles.secondaryActionBtnText, { color: theme.colors.primary }]}>
                        Lihat Butiran & Landmark
                      </Text>
                    </TouchableOpacity>
                  )}

                  {(isLocked || (!isActive && !onPressDetail)) && (
                    <TouchableOpacity
                      style={[styles.closeActionBtn, { borderColor: theme.colors.border, borderRadius: theme.radius.sm }]}
                      onPress={onClose}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.closeActionBtnText, { color: theme.colors.text }]}>Tutup Petunjuk</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    ...SHADOWS.lg,
  },
  dragHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  titleArea: {
    flex: 1,
    marginRight: SPACING.md,
  },
  cpNumber: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  cpName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clueImage: {
    width: '100%',
    height: '100%',
  },
  lockedOverlay: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 8,
  },
  lockedText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  content: {
    gap: 12,
    marginTop: 12,
  },
  infoSection: {
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: 24,
  },
  lockedMessageArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: RADIUS.sm,
    marginTop: 8,
  },
  lockedSubText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeActionBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  closeActionBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    gap: 8,
  },
  secondaryActionBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
