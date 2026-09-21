import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TextInput,
  Image,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { PrimaryButton, SecondaryButton, Card, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import type { Team } from '../types';
import { useApp } from '../AppContext';

import { subscribeToEventTeams, fetchEventTeams } from '../services/teamService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParticipantJoin'>;

export default function ParticipantJoinScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { events, teams, setTeams, activeEvent, setSelectedEventId, isRaceStarted, login } = useApp();

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Form Fields State
  const [eventCode, setEventCode] = useState(activeEvent?.joinCode || activeEvent?.id || 'XT2026');
  const [teamName, setTeamName] = useState('');

  // Subscribe to live Firestore teams for current active event
  React.useEffect(() => {
    const eventId = activeEvent?.id || 'EV-001';
    const unsubscribe = subscribeToEventTeams(eventId, setTeams);
    return () => unsubscribe();
  }, [activeEvent?.id, setTeams]);

  const handleStartSubmit = async () => {
    const cleanEventCode = eventCode.trim().toUpperCase();
    const cleanTeamName = teamName.trim();

    if (!cleanEventCode) {
      Alert.alert('Ralat', 'Sila masukkan Kod Acara.');
      return;
    }
    if (!cleanTeamName) {
      Alert.alert('Ralat', 'Sila masukkan Nama Kumpulan.');
      return;
    }

    setAuthError('');
    setLoading(true);

    try {
      // 1. Verify Event Code against registered events
      const targetEvent = events.find(
        (e) => e.id.toUpperCase() === cleanEventCode || (e.joinCode && e.joinCode.toUpperCase() === cleanEventCode)
      ) || (activeEvent && (activeEvent.id.toUpperCase() === cleanEventCode || (activeEvent.joinCode && activeEvent.joinCode.toUpperCase() === cleanEventCode)) ? activeEvent : null) || activeEvent;

      if (!targetEvent && events.length > 0) {
        const errorMsg = `Kod Acara "${cleanEventCode}" tidak wujud. Sila semak Kod Penyertaan yang diberikan penganjur.`;
        setAuthError(errorMsg);
        Alert.alert('Ralat Log Masuk', errorMsg);
        return;
      }

      const targetEventId = targetEvent?.id || activeEvent?.id || 'EV-001';
      if (targetEvent) {
        setSelectedEventId(targetEvent.id);
      }

      // Fetch live teams directly from Cloud Functions REST API if local state is still populating
      let currentTeams = teams;
      if (!currentTeams || currentTeams.length === 0) {
        const fetched = await fetchEventTeams(targetEventId);
        if (fetched && fetched.length > 0) {
          currentTeams = fetched;
          setTeams(fetched);
        }
      }

      // 2. Verify Team Name against approved teams in Admin Teams Manager (Firestore)
      const matchedTeam = (currentTeams || []).find(
        (t) => t.name.trim().toLowerCase() === cleanTeamName.toLowerCase() ||
               (t.id && t.id.trim().toLowerCase() === cleanTeamName.toLowerCase())
      );

      if (!matchedTeam) {
        const errorMsg = `Nama kumpulan "${cleanTeamName}" tidak ditemui dalam senarai pendaftaran yang diluluskan bagi Kod Acara ${cleanEventCode}. Sila semak semula ejaan nama kumpulan anda.`;
        setAuthError(errorMsg);
        Alert.alert('Ralat Log Masuk', errorMsg);
        return;
      }

      if (matchedTeam.status === 'pending') {
        const errorMsg = `Pendaftaran kumpulan "${matchedTeam.name}" masih dalam status menantikan kelulusan penganjur.`;
        setAuthError(errorMsg);
        Alert.alert('Status Pendaftaran', errorMsg);
        return;
      }

      // 3. Login succeeded! Establish global participant team account session
      login('participant', {
        id: `USR-${matchedTeam.id}`,
        name: matchedTeam.leaderName || matchedTeam.name,
        role: 'participant',
        teamId: matchedTeam.id,
        email: `${matchedTeam.id.toLowerCase()}@xplorequest.com`,
        eventId: targetEvent?.id || activeEvent?.id || 'EV-001',
      });

      // 4. Smart Navigation: Check if team has already checked in attendance
      const isAlreadyCheckedIn = matchedTeam.isPresent === true || matchedTeam.attendanceStatus === 'present';

      if (isAlreadyCheckedIn) {
        if (isRaceStarted) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'StaggeredStart' }],
          });
        }
      } else {
        navigation.navigate('ParticipantAttendanceScan');
      }
    } catch (_err: unknown) {
      const errorMsg = `Gagal menyemak permohonan untuk pasukan "${cleanTeamName}". Sila semak semula maklumat.`;
      setAuthError(errorMsg);
      Alert.alert('Ralat Log Masuk', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'RoleSelect' }],
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1 }}>
            {/* Back Button */}
            <SecondaryButton
              label="Kembali"
              onPress={handleBack}
              icon={<Ionicons name="arrow-back-outline" size={18} color={COLORS.participant.primary} />}
              role="participant"
              variant="outline"
              style={styles.backButton}
            />

            {/* Title Section */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Image
                  source={require('../assets/XploreQuest_Icon.png')}
                  style={{ width: 52, height: 52 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Sertai Acara Kumpulan</Text>
              <Text style={styles.subtitle}>
                Sila masukkan Kod Acara dan Nama Kumpulan anda yang telah diluluskan oleh penganjur.
              </Text>
            </View>

            {/* Action Form Card */}
            <Card style={styles.formCard} role="participant">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>KOD PENYERTAAN ACARA</Text>
                <TextInput
                  style={[styles.textInput, styles.codeHighlight]}
                  placeholder="Contoh: XT2026"
                  value={eventCode}
                  onChangeText={setEventCode}
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NAMA KUMPULAN</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: Pasukan Harimau"
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {authError ? (
                <View style={styles.errorNotice}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                  <Text style={styles.errorNoticeText}>{authError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={loading ? "Menyemak..." : "Sertai Acara (Join Event)"}
                onPress={handleStartSubmit}
                disabled={loading}
                role="participant"
                icon={<Ionicons name="log-in-outline" size={20} color={COLORS.textLight} />}
                style={styles.submitBtn}
              />
            </Card>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.h2,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  formCard: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.participant.primary,
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  textInput: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.body,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
  },
  codeHighlight: {
    letterSpacing: 2,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  submitBtn: {
    marginTop: SPACING.sm,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorNoticeText: {
    fontSize: 12,
    color: COLORS.danger,
    flex: 1,
  },
});
