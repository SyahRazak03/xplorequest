import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

export interface WatchTeam {
  teamId: string;
  teamName: string;
  elapsedMinutes: number;
}

interface AdminDNFWatchPanelProps {
  teams: WatchTeam[];
  maxRaceTimeLimit: number;
  onFastForward: () => void;
}

export const AdminDNFWatchPanel: React.FC<AdminDNFWatchPanelProps> = ({
  teams,
  maxRaceTimeLimit,
  onFastForward,
}) => {
  return (
    <Card role="admin" borderAccent="top" title="Pemantauan DNF Automatik (ADM-06)">
      <Text style={styles.description}>
        Sistem memantau had masa maksimum peserta ({maxRaceTimeLimit} Minit). Pasukan yang melepasi had masa akan ditandakan DNF secara automatik.
      </Text>

      {/* Debug Controls */}
      <View style={styles.debugRow}>
        <TouchableOpacity style={styles.fastForwardBtn} activeOpacity={0.8} onPress={onFastForward}>
          <Ionicons name="play-forward-outline" size={16} color={COLORS.textLight} />
          <Text style={styles.fastForwardBtnText}>⏩ Tambah Masa Ujian (+15 Min)</Text>
        </TouchableOpacity>
      </View>

      {teams.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.success} />
          <Text style={styles.emptyText}>Tiada Kumpulan Aktif Sedang Dipantau</Text>
          <Text style={styles.emptySubtext}>Semua pasukan telah tamat atau disingkirkan.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollWrapper} nestedScrollEnabled={true}>
          <View style={styles.teamsList}>
            {teams.map(team => {
              const remaining = maxRaceTimeLimit - team.elapsedMinutes;
              const isUrgent = remaining <= 10;
              const isCritical = remaining <= 5;

              return (
                <View key={team.teamId} style={styles.teamWatchCard}>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName} numberOfLines={1}>
                      {team.teamName}
                    </Text>
                    <Text style={styles.elapsedText}>Masa Berjalan: {team.elapsedMinutes} Min</Text>
                  </View>

                  <View
                    style={[
                      styles.remainingBadge,
                      isCritical
                        ? styles.criticalBadge
                        : isUrgent
                        ? styles.urgentBadge
                        : styles.normalBadge,
                    ]}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={12}
                      color={isCritical || isUrgent ? '#FFFFFF' : COLORS.text}
                      style={styles.timerIcon}
                    />
                    <Text
                      style={[
                        styles.remainingText,
                        (isCritical || isUrgent) && styles.whiteText,
                      ]}
                    >
                      {remaining > 0 ? `${remaining}m baki` : 'Selesai Tempoh'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  description: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  debugRow: {
    marginBottom: SPACING.sm,
  },
  fastForwardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.admin.accent,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    gap: 6,
    alignSelf: 'flex-start',
    ...SHADOWS.sm,
  },

  fastForwardBtnText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  scrollWrapper: {
    maxHeight: 180,
  },
  teamsList: {
    gap: SPACING.xs,
  },
  teamWatchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  elapsedText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
  },
  timerIcon: {
    marginRight: 4,
  },
  normalBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  urgentBadge: {
    backgroundColor: '#F59E0B', // Amber
  },
  criticalBadge: {
    backgroundColor: COLORS.danger, // Red
  },
  remainingText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  whiteText: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  emptySubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
