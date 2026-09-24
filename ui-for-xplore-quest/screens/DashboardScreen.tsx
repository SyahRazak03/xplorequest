import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Platform,
} from 'react-native';


import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import ParticipantDashboardScreen from './ParticipantDashboardScreen';
import CrewDashboardScreen from './CrewDashboardScreen';
import { Avatar, Card, Badge, OfflineStatusChip } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type DashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user, role, theme, logout, activeEvent, isOffline, setIsOffline, crewPinCode, events, setSelectedEventId } = useApp();

  if (role === 'participant') {
    return <ParticipantDashboardScreen />;
  }

  if (role === 'crew') {
    return <CrewDashboardScreen />;
  }


  const handleLogout = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'RoleSelect' }],
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const handleEventPress = (eventId: string) => {
    setSelectedEventId(eventId);
    navigation.navigate('AdminEventDetail' as any);
  };


  // Roadmap details to show progress during demo
  const getRoadmapForRole = () => {
    switch (role as any) {
      case 'participant':
        return [
          { label: 'Team Registration & Login', done: true },
          { label: 'Checkpoint Clues & Geofence Boundaries', done: false, stage: 'Stage 2' },
          { label: 'Congested Checkpoint Bypass (Skip Logic)', done: false, stage: 'Stage 2' },
          { label: 'Dynamic 30s Crew QR Scan', done: false, stage: 'Stage 3' },
          { label: 'Finish Line Clearance', done: false, stage: 'Stage 4' },
        ];
      case 'crew':
        return [
          { label: 'Login & Checkpoint Registration', done: true },
          { label: 'Team Arrival List & Queue', done: false, stage: 'Stage 3' },
          { label: 'Team-Locked Dynamic QR Generation', done: false, stage: 'Stage 3' },
          { label: 'Photo Proof Upload (Camera Snap)', done: false, stage: 'Stage 4' },
          { label: 'Manual Override & Additional Penalties', done: false, stage: 'Stage 4' },
        ];
      case 'admin':
        return [
          { label: 'Secretariat / Admin Login', done: true },
          { label: 'Geofence Creation & Event Parameters', done: false, stage: 'Stage 0.5' },
          { label: 'Start Line Approval & Team Release', done: false, stage: 'Stage 2' },
          { label: 'Leaderboard Display & Real-Time Clock', done: false, stage: 'Stage 5' },
          { label: 'Automatic DNF Audit & Penalties', done: false, stage: 'Stage 5' },
        ];
      default:
        return [];
    }
  };

  const getRoleLabel = () => {
    switch (role as any) {
      case 'participant':
        return 'Team Leader';
      case 'crew':
        return 'Crew Marshal';
      case 'admin':
        return 'Organizer Admin';
      default:
        return 'Guest';
    }
  };

  const roadmap = getRoadmapForRole();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Top Header Card */}
        <View style={styles.topHeader}>
          <View style={styles.userProfileRow}>
            <Avatar initials={getInitials(user?.name)} role={role || 'participant'} size="lg" />
            <View style={styles.userMeta}>
              <Text style={styles.welcomeText}>Welcome Back,</Text>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'admin@xplorequest.com'}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={getRoleLabel()} state="success" />
            <OfflineStatusChip />
          </View>

        </View>

        {/* Admin Dashboard: Event Selection List */}
        {role === 'admin' ? (
          <View style={styles.adminActionsContainer}>
            <TouchableOpacity
              style={[styles.createEventButton, { backgroundColor: theme.colors.primary, marginBottom: SPACING.md }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AdminCreateEvent' as any)}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.textLight} />
              <Text style={styles.createEventButtonText}>Create New Event</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Your Event List</Text>

            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                activeOpacity={0.9}
                onPress={() => handleEventPress(event.id)}
                style={{ marginBottom: SPACING.sm }}
              >
                <Card role="admin" borderAccent="left">
                  <View style={styles.eventInfoContainer}>
                    <View style={styles.infoRow}>
                      <Ionicons name="trophy-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.eventTitle}>{event.name}</Text>
                    </View>
                    <View style={styles.infoRowSecondary}>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                      <Text style={styles.eventDetailText}>{event.date}</Text>
                    </View>
                    <View style={styles.infoRowSecondary}>
                      <Ionicons name="pin-outline" size={14} color={COLORS.textMuted} />
                      <Text style={styles.eventDetailText} numberOfLines={1}>
                        {event.locationName}
                      </Text>
                    </View>
                    <View style={styles.cardDivider} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                      <Text style={{ fontSize: 11, color: COLORS.admin.primary, fontWeight: 'bold' }}>
                        Manage Event & Geofence/CP Modules
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.admin.primary} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* Participant or default Active Event Details */
          <Card role={role || 'participant'} borderAccent="left" title="Your Active Event">
            <View style={styles.eventInfoContainer}>
              <View style={styles.infoRow}>
                <Ionicons name="trophy-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.eventTitle}>{activeEvent?.name || 'No Active Event'}</Text>
              </View>
              <View style={styles.infoRowSecondary}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.eventDetailText}>{activeEvent?.date || '-'}</Text>
              </View>
              <View style={styles.infoRowSecondary}>
                <Ionicons name="pin-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.eventDetailText} numberOfLines={1}>
                  {activeEvent?.locationName || '-'}
                </Text>
              </View>
            </View>
          </Card>
        )}





        {/* Actions Showcase */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  scrollContainer: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    flexGrow: 1,
  },
  topHeader: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  userMeta: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  userName: {
    fontSize: TYPOGRAPHY.fontSize.h2,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  eventIdText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  eventInfoContainer: {
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    flex: 1,
  },
  infoRowSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: 4,
  },
  eventDetailText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  boldText: {
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionContainer: {
    marginTop: SPACING.xs,
  },
  roadmapContainer: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    ...SHADOWS.sm,
    marginTop: SPACING.md,
  },
  roadmapItem: {
    flexDirection: 'row',
    gap: SPACING.md,
    minHeight: 52,
  },
  stepIndicator: {
    alignItems: 'center',
    width: 20,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  stepDetails: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  stepLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  completedStepLabel: {
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
  },
  stageText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  actionsContainer: {
    gap: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  showcaseButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  showcaseButtonText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.danger,
  },
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  createEventButtonText: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textLight,
  },
  adminActionsContainer: {
    gap: SPACING.md,
  },
  demoToggleCard: {
    padding: SPACING.md,
    marginTop: SPACING.xs,
  },
  demoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  demoToggleText: {
    flex: 1,
  },
  demoToggleTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  demoToggleSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
});






