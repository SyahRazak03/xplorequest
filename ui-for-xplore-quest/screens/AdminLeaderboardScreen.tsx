import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Card, Badge, AdminDNFWatchPanel, SkeletonLoader, EmptyState } from '../components';

import { useApp } from '../AppContext';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

interface LeaderboardTeam {
  teamId: string;
  teamName: string;
  points: number;
  totalTimeFormatted: string;
  penaltiesMinutes: number;
  status: 'active' | 'finished' | 'dnf' | 'registered';
  lastChange?: 'up' | 'down' | null;
  elapsedMinutes?: number;
}

export default function AdminLeaderboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { rules, isRaceStarted, teams: appTeams, activeEvent } = useApp();

  const [loading, setLoading] = useState(true);

  // Pulse animation for the Live indicator
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  // Filter state: 'all' | 'active' | 'finished' | 'dnf'
  const [filter, setFilter] = useState<'all' | 'active' | 'finished' | 'dnf'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Leaderboard data state dynamically managed
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardTeam[]>([]);

  // Flash notification state for live changes
  const [tickerMessage, setTickerMessage] = useState<string | null>(null);

  // Monitor elapsed minutes of active teams to trigger DNF when exceeding maxRaceTime
  useEffect(() => {
    const limit = rules.maxRaceTime;
    const exceeded = leaderboardData.find(
      t => t.status === 'active' && t.elapsedMinutes !== undefined && t.elapsedMinutes > limit
    );

    if (exceeded) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLeaderboardData(prev =>
        prev.map(t =>
          t.teamId === exceeded.teamId
            ? { ...t, status: 'dnf', points: 0, totalTimeFormatted: 'N/A' }
            : t
        )
      );
      setTickerMessage(`${exceeded.teamName} ditandakan DNF — melebihi had masa (${limit} min).`);
    }
  }, [leaderboardData, rules.maxRaceTime]);

  const handleFastForward = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLeaderboardData(prev =>
      prev.map(t => {
        if (t.status === 'active' && t.elapsedMinutes !== undefined) {
          return {
            ...t,
            elapsedMinutes: t.elapsedMinutes + 15,
          };
        }
        return t;
      })
    );
    setTickerMessage('Masa simulasi dipercepatkan: +15 Minit bagi semua kumpulan aktif.');
  };


  // 1. Run live dot pulsing animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 2. Simulated real-time sorting/ticking updates (only when race has started)
  useEffect(() => {
    if (!isRaceStarted) return;

    const liveInterval = setInterval(() => {
      // Choose 2 random indexes (excluding DNF statuses for points fluctuation)
      const nonDnfIndices: number[] = [];
      leaderboardData.forEach((team, idx) => {
        if (team.status !== 'dnf') {
          nonDnfIndices.push(idx);
        }
      });

      if (nonDnfIndices.length < 2) return;

      const idx1 = nonDnfIndices[Math.floor(Math.random() * nonDnfIndices.length)];
      let idx2 = nonDnfIndices[Math.floor(Math.random() * nonDnfIndices.length)];
      while (idx1 === idx2) {
        idx2 = nonDnfIndices[Math.floor(Math.random() * nonDnfIndices.length)];
      }

      // Determine score changes (+10, +20, -10, etc.)
      const changeOptions = [10, 20, -10, -20];
      const change1 = changeOptions[Math.floor(Math.random() * changeOptions.length)];
      const change2 = changeOptions[Math.floor(Math.random() * changeOptions.length)];

      // Configure layout animation for smooth row reordering
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setLeaderboardData(prev => {
        const updated = prev.map((team, idx) => {
          let pts = team.points;
          let change: 'up' | 'down' | null = null;

          if (idx === idx1) {
            pts = Math.max(0, pts + change1);
            change = change1 > 0 ? 'up' : 'down';
          } else if (idx === idx2) {
            pts = Math.max(0, pts + change2);
            change = change2 > 0 ? 'up' : 'down';
          } else {
            change = null;
          }

          return {
            ...team,
            points: pts,
            lastChange: change,
          };
        });

        // Re-sort descending by points
        return updated.sort((a, b) => {
          if (a.status === 'dnf' && b.status !== 'dnf') return 1;
          if (b.status === 'dnf' && a.status !== 'dnf') return -1;
          return b.points - a.points;
        });
      });

      // Show temporary ticker message
      const team1 = leaderboardData[idx1];
      const team2 = leaderboardData[idx2];
      setTickerMessage(
        `Skor Terkini: ${team1.teamName} (${change1 > 0 ? '+' : ''}${change1}) & ${team2.teamName} (${change2 > 0 ? '+' : ''}${change2})`
      );

      // Hide ticker message after 3 seconds
      setTimeout(() => {
        setTickerMessage(null);
      }, 3000);

    }, 5000);

    return () => clearInterval(liveInterval);
  }, [leaderboardData]);

  // Derive list of teams that have scanned attendance at Start Checkpoint
  const attendedTeams = appTeams.filter((t) => t.isPresent || t.attendanceStatus === 'present');

  const rawList: LeaderboardTeam[] = attendedTeams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    points: (t as any).points ?? 0,
    totalTimeFormatted: (t as any).totalTimeFormatted || '--:--',
    penaltiesMinutes: (t as any).penaltiesMinutes || 0,
    status: (t.status === 'approved' ? (isRaceStarted ? 'active' : 'registered') : (t.status as any)) || 'registered',
  }));

  const activeList = isRaceStarted && leaderboardData.length > 0 ? leaderboardData : rawList;

  // Filter logic
  const filteredData = activeList.filter((team) => {
    if (filter === 'all') return true;
    return team.status === filter;
  });

  const getStatusBadge = (status: 'active' | 'finished' | 'dnf' | 'registered') => {
    switch (status) {
      case 'finished':
        return <Badge label="SELESAI" state="success" size="sm" />;
      case 'dnf':
        return <Badge label="DNF" state="danger" size="sm" />;
      case 'registered':
        return <Badge label="BERDAFTAR" state="success" size="sm" />;
      case 'active':
      default:
        return <Badge label="AKTIF" state="pending" size="sm" />;
    }
  };

  // Highlighting rank style details
  const getRankHighlightStyle = (rankIndex: number) => {
    if (rankIndex === 0) return { borderLeftColor: '#D4AF37', borderLeftWidth: 4 }; // Gold
    if (rankIndex === 1) return { borderLeftColor: '#C0C0C0', borderLeftWidth: 4 }; // Silver
    if (rankIndex === 2) return { borderLeftColor: '#CD7F32', borderLeftWidth: 4 }; // Bronze
    return {};
  };

  const getRankMedal = (team: LeaderboardTeam, rankIndex: number) => {
    if (team.status === 'dnf') {
      return <Ionicons name="alert-circle-outline" size={18} color={COLORS.textMuted} />;
    }
    // Calculate rank excluding DNFed teams
    const rankExcludingDnf = leaderboardData
      .filter(t => t.status !== 'dnf')
      .findIndex(t => t.teamId === team.teamId);

    if (rankExcludingDnf === 0) return <Ionicons name="trophy" size={20} color="#D4AF37" />;
    if (rankExcludingDnf === 1) return <Ionicons name="trophy" size={18} color="#C0C0C0" />;
    if (rankExcludingDnf === 2) return <Ionicons name="trophy" size={18} color="#CD7F32" />;
    return <Text style={styles.rankNumberText}>{rankExcludingDnf + 1}</Text>;
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Keputusan Rasmi Acara</Text>
            <Text style={styles.headerSubtitle}>Pemantauan kedudukan masa nyata (ADM-05)</Text>
          </View>
        </View>
        <View style={{ padding: SPACING.md }}>
          <SkeletonLoader type="list" />
        </View>
      </SafeAreaView>
    );
  }

  return (

    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Keputusan Rasmi Acara</Text>
            <Text style={styles.headerSubtitle}>Pemantauan kedudukan masa nyata (ADM-05)</Text>
          </View>
        </View>

        {/* Live / Status indicator */}
        <View style={[styles.liveIndicatorContainer, !isRaceStarted && { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
          <Animated.View style={[styles.liveDot, { opacity: isRaceStarted ? pulseOpacity : 1, backgroundColor: isRaceStarted ? COLORS.success : COLORS.warning }]} />
          <Text style={[styles.liveIndicatorText, { color: isRaceStarted ? COLORS.success : COLORS.warning }]}>
            {isRaceStarted ? 'LIVE' : 'BELUM MULA'}
          </Text>
        </View>
      </View>

      {/* Ticker Feed / Notification Toast */}
      {tickerMessage && (
        <View style={styles.tickerContainer}>
          <Ionicons name="flash" size={14} color={COLORS.admin.accent} />
          <Text style={styles.tickerText} numberOfLines={1}>
            {tickerMessage}
          </Text>
        </View>
      )}

      {/* Filter Chips row */}
      <View style={styles.filterContainer}>
        {(['all', 'active', 'finished', 'dnf'] as const).map(f => {
          const isSelected = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setFilter(f);
              }}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {f === 'all' && 'Semua'}
                {f === 'active' && 'Aktif'}
                {f === 'finished' && 'Selesai'}
                {f === 'dnf' && 'DNF'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Leaderboard Table / Rows */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {!isRaceStarted && (
          <View style={styles.pendingInfoBanner}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.admin.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingBannerTitle}>
                Pelepasan Acara Belum Bermula
              </Text>
              <Text style={styles.pendingBannerSubtitle}>
                Keputusan live, pemantauan timer, dan denda DNF akan diaktifkan secara automatik sebaik sahaja krew pos kawalan memulakan pelepasan perlumbaan.
              </Text>
            </View>
          </View>
        )}

        {isRaceStarted && filter === 'all' && (
          <AdminDNFWatchPanel
            teams={leaderboardData
              .filter(t => t.status === 'active' && t.elapsedMinutes !== undefined)
              .map(t => ({
                teamId: t.teamId,
                teamName: t.teamName,
                elapsedMinutes: t.elapsedMinutes!,
              }))}
            maxRaceTimeLimit={rules.maxRaceTime}
            onFastForward={handleFastForward}
          />
        )}

        {filteredData.length === 0 ? (
          <EmptyState
            title="Tiada Pasukan Hadir Lagi"
            description="Belum ada pasukan yang mengimbas imbasan kehadiran di Pos Kehadiran Mula. Senarai akan dikemas kini secara automatik apabila imbasan disahkan."
            icon="people-outline"
          />
        ) : (
          filteredData.map((team, idx) => {
            // Find overall rank index in complete sorted array to display correct medals
            const overallRank = leaderboardData.findIndex(t => t.teamId === team.teamId);

            return (
              <Card
                key={team.teamId}
                role="admin"
                style={[
                  styles.rowCard,
                  getRankHighlightStyle(overallRank),
                  team.status === 'dnf' && { opacity: 0.5, backgroundColor: 'rgba(0, 0, 0, 0.03)' },
                ]}
                contentStyle={styles.rowCardContent}
              >
                {/* Left: Medal or Rank number */}
                <View style={styles.rankWrapper}>
                  {getRankMedal(team, overallRank)}
                </View>


                {/* Middle: Team name & Status details */}
                <View style={styles.teamDetailsWrapper}>
                  <Text style={styles.teamNameText}>{team.teamName}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>Masa: {team.totalTimeFormatted}</Text>
                    {team.penaltiesMinutes > 0 && (
                      <Text style={styles.penaltyText}>Denda: +{team.penaltiesMinutes}m</Text>
                    )}
                  </View>
                </View>

                {/* Right: Points count & Status Badge */}
                <View style={styles.scoreWrapper}>
                  {rules.pointsSystemEnabled && (
                    <View style={styles.pointsRow}>
                      <Text style={styles.pointsNumberText}>{team.points}</Text>
                      <Text style={styles.pointsLabelText}>Mata</Text>
                      {team.lastChange && (
                        <Ionicons
                          name={team.lastChange === 'up' ? 'arrow-up' : 'arrow-down'}
                          size={14}
                          color={team.lastChange === 'up' ? COLORS.success : COLORS.danger}
                          style={styles.changeIcon}
                        />
                      )}
                    </View>
                  )}
                  <View style={styles.badgeWrapper}>
                    {getStatusBadge(team.status)}
                  </View>
                </View>

              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.8,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  tickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.admin.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tickerText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 8,
    ...SHADOWS.sm,
  },

  filterChipActive: {
    backgroundColor: COLORS.admin.primary,
    borderColor: COLORS.admin.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: COLORS.textLight,
  },
  listContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  rowCard: {
    padding: SPACING.sm + 2,
    marginBottom: 0,
  },
  rowCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
  },
  rankWrapper: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
  },
  teamDetailsWrapper: {
    flex: 1,
    marginLeft: SPACING.sm,
    paddingRight: SPACING.xs,
  },
  teamNameText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  penaltyText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  scoreWrapper: {
    alignItems: 'flex-end',
    width: 90,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    position: 'relative',
  },
  pointsNumberText: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  pointsLabelText: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  changeIcon: {
    position: 'absolute',
    right: -15,
    top: 4,
  },
  badgeWrapper: {
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginTop: SPACING.sm,
  },
  pendingInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.admin.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  pendingBannerTitle: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  pendingBannerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  startRaceTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.admin.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap: 8,
    marginBottom: SPACING.xs,
    ...SHADOWS.sm,
  },
  startRaceTriggerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
