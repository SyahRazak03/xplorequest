import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkpoint, CheckpointStatus } from '../mockData';
import { getThemeForRole, COLORS } from '../theme';
import { Badge } from './Badge';
import { useApp } from '../AppContext';

interface CheckpointListItemProps {
  checkpoint: Checkpoint;
  status: CheckpointStatus;
  index: number;
  onPressScan?: () => void;
  onPressMap?: () => void;
  onPressDetail?: () => void;
}

export const CheckpointListItem: React.FC<CheckpointListItemProps> = ({
  checkpoint,
  status,
  index,
  onPressScan,
  onPressMap,
  onPressDetail,
}) => {
  const [expanded, setExpanded] = useState(status === 'active');
  const theme = getThemeForRole('participant');
  const { colors, radius, spacing, typography, shadows } = theme;
  const { rules } = useApp();


  // Get visual config based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: colors.success,
          bgColor: '#F0FDF4', // Light success green
          borderColor: '#DCFCE7',
          statusText: 'Selesai',
          statusState: 'success' as const,
        };
      case 'active':
        return {
          icon: 'play-circle' as const,
          iconColor: colors.primary,
          bgColor: colors.primaryLight,
          borderColor: colors.primary,
          statusText: 'Sedang Aktif',
          statusState: 'warning' as const, // orange-ish alert
        };
      case 'pending':
        return {
          icon: 'alert-circle' as const,
          iconColor: colors.pending,
          bgColor: '#FEF3C7', // Light amber
          borderColor: '#FDE68A',
          statusText: 'Dilangkau / Sedia',
          statusState: 'warning' as const,
        };
      case 'locked':
      default:
        return {
          icon: 'lock-closed' as const,
          iconColor: colors.textMuted,
          bgColor: '#F8FAFC', // Slate 50
          borderColor: colors.border,
          statusText: 'Terkunci',
          statusState: 'neutral' as const,
        };
    }
  };

  const statusConfig = getStatusConfig();

  const toggleExpand = () => {
    if (status !== 'locked') {
      setExpanded(!expanded);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.md,
          borderColor: status === 'active' ? colors.primary : colors.border,
          borderWidth: status === 'active' ? 1.5 : 1,
          backgroundColor: colors.card,
          ...shadows.sm,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
          },
        ]}
        activeOpacity={status === 'locked' ? 1 : 0.7}
        onPress={toggleExpand}
      >
        {/* Status Indicator Icon */}
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: statusConfig.bgColor,
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name={statusConfig.icon} size={22} color={statusConfig.iconColor} />
        </View>

        {/* Checkpoint Meta Info */}
        <View style={styles.textContainer}>
          <View style={styles.topRow}>
            <Text
              style={[
                styles.cpNumber,
                {
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.bold,
                  color: status === 'active' ? colors.primary : colors.textMuted,
                },
              ]}
            >
              {checkpoint.isStart ? 'MULA' : checkpoint.isFinish ? 'TAMAT' : `CP ${index}`}
            </Text>
              <View style={styles.badgeRow}>
                {checkpoint.isAttendanceStation && (
                  <Badge label="Stesen Kehadiran" state="warning" />
                )}
                {rules.pointsSystemEnabled && (
                  <Badge
                    label={`${checkpoint.scorePoints} Mata`}
                    state={status === 'completed' ? 'success' : 'info'}
                  />
                )}
              </View>
          </View>

          <Text
            style={[
              styles.nameText,
              {
                fontSize: typography.fontSize.bodyLarge - 1,
                fontWeight: typography.fontWeight.semiBold,
                color: status === 'locked' ? colors.textMuted : colors.text,
              },
            ]}
            numberOfLines={1}
          >
            {checkpoint.name}
          </Text>
        </View>

        {/* Toggle Indicator Arrow */}
        {status !== 'locked' && (
          <Ionicons
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={18}
            color={colors.textMuted}
          />
        )}
      </TouchableOpacity>

      {/* Expanded Details section */}
      {expanded && status !== 'locked' && (
        <View
          style={[
            styles.detailsContainer,
            {
              borderTopColor: colors.border,
              borderTopWidth: 1,
              padding: spacing.md,
              backgroundColor: '#FAFAF9', // Malaysian off-white tint for detail pane
            },
          ]}
        >
          {/* Clue Section */}
          <View style={styles.detailSection}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bulb-outline" size={16} color={colors.accent} />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.accent,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.bold,
                  },
                ]}
              >
                PETUNJUK / KLU
              </Text>
            </View>
            <Text
              style={[
                styles.detailText,
                {
                  color: colors.text,
                  fontSize: typography.fontSize.body - 1,
                  lineHeight: 20,
                },
              ]}
            >
              {checkpoint.clueText}
            </Text>
          </View>

          {/* Task Description */}
          <View style={[styles.detailSection, { marginTop: spacing.md }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="checkbox-outline" size={16} color={colors.primary} />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.primary,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.bold,
                  },
                ]}
              >
                TUGASAN DI POS
              </Text>
            </View>
            <Text
              style={[
                styles.detailText,
                {
                  color: colors.text,
                  fontSize: typography.fontSize.body - 1,
                  lineHeight: 20,
                },
              ]}
            >
              {checkpoint.taskDescription}
            </Text>
          </View>

          {/* Action Buttons based on status */}
          <View style={[styles.actionsRow, { marginTop: spacing.md }]}>
              {onPressDetail && (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: colors.primary,
                      borderWidth: 1,
                      borderRadius: radius.sm,
                    },
                  ]}
                  onPress={onPressDetail}
                  activeOpacity={0.7}
                >
                  <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: colors.primary, fontWeight: typography.fontWeight.bold },
                    ]}
                  >
                    Butiran Clue
                  </Text>
                </TouchableOpacity>
              )}

              {(status === 'active' || status === 'pending') && onPressScan && (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.scanBtn,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: radius.sm,
                    },
                  ]}
                  onPress={onPressScan}
                  activeOpacity={0.7}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                  <Text
                    style={[
                      styles.actionBtnText,
                      styles.scanBtnText,
                      { fontWeight: typography.fontWeight.bold },
                    ]}
                  >
                    {status === 'pending' ? 'Imbas QR Sedia' : 'Imbas QR'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
        </View>
      )}

      {/* Locked message displayed on header press attempt */}
      {status === 'locked' && (
        <View
          style={[
            styles.lockedHint,
            {
              backgroundColor: '#F8FAFC',
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingVertical: spacing.xs + 2,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Text style={[styles.lockedHintText, { fontSize: typography.fontSize.caption - 1 }]}>
            🔒 Selesaikan checkpoint sebelumnya untuk mendedahkan maklumat.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cpNumber: {
    letterSpacing: 1,
  },
  nameText: {
    paddingRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsContainer: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  detailSection: {
    gap: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    letterSpacing: 0.8,
  },
  detailText: {
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionBtnText: {
    fontSize: 13,
  },
  scanBtn: {
    borderWidth: 0,
  },
  scanBtnText: {
    color: '#FFFFFF',
  },
  lockedHint: {
    alignItems: 'center',
  },
  lockedHintText: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
