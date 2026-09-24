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
  const { rules, isRaceStarted, teams: appTeams, activeEvent, checkpoints } = useApp();

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

  // Helper to calculate total team points
  const getTeamPoints = (team: any) => {
    const completedIds = Array.isArray(team.completedCheckpointIds) ? team.completedCheckpointIds : [];
    const calcPts = completedIds.reduce((sum: number, cpId: string) => {
      const cp = (checkpoints || []).find((c: any) => c.id === cpId);
      return sum + (cp?.scorePoints || 0);
    }, 0);
    const ptsField = typeof team.points === 'number' ? team.points : (typeof team.totalPoints === 'number' ? team.totalPoints : 0);
    return Math.max(calcPts, ptsField);
  };

  // Sync real-time appTeams to leaderboardData whenever appTeams or checkpoints change
  useEffect(() => {
    if (!appTeams || appTeams.length === 0) return;

    const normalCps = (checkpoints || []).filter(c => !c.isStart && !c.isFinish);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLeaderboardData(prev => {
      const newList: LeaderboardTeam[] = appTeams.map((t) => {
        const existing = prev.find(p => p.teamId === t.id);
        const pts = getTeamPoints(t);
        const completedCount = (t.completedCheckpointIds || []).length;
        const isFinished = normalCps.length > 0 && completedCount >= normalCps.length;

        let lastChange: 'up' | 'down' | null = existing?.lastChange || null;
        if (existing && existing.points !== pts) {
          lastChange = pts > existing.points ? 'up' : 'down';
        }

        return {
          teamId: t.id,
          teamName: t.name,
          points: pts,
          totalTimeFormatted: (t as any).totalTimeFormatted || '--:--',
          penaltiesMinutes: (t as any).penaltiesMinutes || 0,
          status: (t as any).status === 'dnf'
            ? 'dnf'
            : isFinished
            ? 'finished'
            : isRaceStarted
            ? 'active'
            : 'registered',
          lastChange,
          elapsedMinutes: existing?.elapsedMinutes || 0,
        };
      });

      return newList.sort((a, b) => {
        if (a.status === 'dnf' && b.status !== 'dnf') return 1;
        if (b.status === 'dnf' && a.status !== 'dnf') return -1;
        return b.points - a.points;
      });
    });
  }, [appTeams, checkpoints, isRaceStarted]);

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
      setTickerMessage(`${exceeded.teamName} marked DNF — exceeded time limit (${limit} min).`);
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
    setTickerMessage('Simulation time fast-forwarded: +15 Mins for all active teams.');
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

  const activeList: LeaderboardTeam[] = leaderboardData.length > 0 ? leaderboardData : (appTeams || []).map((t) => ({
    teamId: t.id,
    teamName: t.name,
    points: getTeamPoints(t),
    totalTimeFormatted: (t as any).totalTimeFormatted || '--:--',
    penaltiesMinutes: (t as any).penaltiesMinutes || 0,
    status: (t.status === 'approved' ? (isRaceStarted ? 'active' : 'registered') : (t.status as any)) || 'registered',
    lastChange: null,
  }));

  // Filter logic
  const filteredData = activeList.filter((team) => {
    if (filter === 'all') return true;
    return team.status === filter;
  });

  const getStatusBadge = (status: 'active' | 'finished' | 'dnf' | 'registered') => {
    switch (status) {
      case 'finished':
        return <Badge label="FINISHED" state="success" size="sm" />;
      case 'dnf':
        return <Badge label="DNF" state="danger" size="sm" />;
      case 'registered':
        return <Badge label="REGISTERED" state="success" size="sm" />;
      case 'active':
      default:
        return <Badge label="ACTIVE" state="pending" size="sm" />;
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
            <Text style={styles.headerTitle}>Official Event Results</Text>
            <Text style={styles.headerSubtitle}>Real-time leaderboard monitoring</Text>
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
            <Text style={styles.headerTitle}>Official Event Results</Text>
            <Text style={styles.headerSubtitle}>Real-time leaderboard monitoring</Text>
          </View>
        </View>

        {/* Live / Status indicator */}
        <View style={[styles.liveIndicatorContainer, !isRaceStarted && { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
          <Animated.View style={[styles.liveDot, { opacity: isRaceStarted ? pulseOpacity : 1, backgroundColor: isRaceStarted ? COLORS.success : COLORS.warning }]} />
          <Text style={[styles.liveIndicatorText, { color: isRaceStarted ? COLORS.success : COLORS.warning }]}>
            {isRaceStarted ? 'LIVE' : 'NOT STARTED'}
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
                {f === 'all' && 'All'}
                {f === 'active' && 'Active'}
                {f === 'finished' && 'Finished'}
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
                Event Start Pending
              </Text>
              <Text style={styles.pendingBannerSubtitle}>
                Live results, timer tracking, and DNF penalties will activate automatically once crew starts the race release.
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
            title="No Teams Present Yet"
            description="No team has scanned attendance at the Start Checkpoint yet. List will update automatically when scans are verified."
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
                    <Text style={styles.metaText}>Time: {team.totalTimeFormatted}</Text>
                    {team.penaltiesMinutes > 0 && (
                      <Text style={styles.penaltyText}>Penalty: +{team.penaltiesMinutes}m</Text>
                    )}
                  </View>
                </View>

                {/* Right: Points count & Status Badge */}
                <View style={styles.scoreWrapper}>
                  {rules.pointsSystemEnabled && (
                    <View style={styles.pointsRow}>
                      <Text style={styles.pointsNumberText}>{team.points}</Text>
                      <Text style={styles.pointsLabelText}>Pts</Text>
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
