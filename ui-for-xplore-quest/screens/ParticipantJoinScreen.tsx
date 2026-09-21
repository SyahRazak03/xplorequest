import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { PrimaryButton, SecondaryButton, Card, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { registerTeam, checkinTeamAttendance } from '../services/teamService';
import type { Team } from '../types';
import { useApp } from '../AppContext';
import RealCameraQRScanner from '../components/RealCameraQRScanner';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParticipantJoin'>;

export default function ParticipantJoinScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { events, teams, activeEvent, setSelectedEventId, login } = useApp();

  // States: 'input' | 'checkin' | 'error'
  const [status, setStatus] = useState<'input' | 'checkin' | 'error'>('input');
  const [authError, setAuthError] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form Fields State
  const [eventCode, setEventCode] = useState(activeEvent?.joinCode || activeEvent?.id || 'XT2026');
  const [teamName, setTeamName] = useState('');
  const [registeredTeam, setRegisteredTeam] = useState<Team | null>(null);

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
      // Find matching event
      const targetEvent = events.find(
        (e) => e.id.toUpperCase() === cleanEventCode || (e.joinCode && e.joinCode.toUpperCase() === cleanEventCode)
      ) || activeEvent;

      if (targetEvent) {
        setSelectedEventId(targetEvent.id);
      }

      // Check for team in teams state (synced with Firestore / Admin Teams Manager)
      const matchedTeam = (teams || []).find(
        (t) => t.name.trim().toLowerCase() === cleanTeamName.toLowerCase() ||
               (t.id && t.id.toLowerCase() === cleanTeamName.toLowerCase())
      );

      if (matchedTeam) {
        setRegisteredTeam(matchedTeam);
        setStatus('checkin');
      } else {
        // Fallback team creation for participant check-in
        const fallbackTeam: Team = {
          id: `TM-${cleanTeamName.replace(/\s+/g, '')}`,
          name: cleanTeamName,
          status: 'approved',
          isPresent: false,
          attendanceStatus: 'absent',
          memberCount: 4,
          startCheckpointId: 'CP-START',
          currentCheckpointId: 'CP-001',
          completedCheckpointIds: [],
          skippedCheckpointIds: [],
        };
        setRegisteredTeam(fallbackTeam);
        setStatus('checkin');
      }
    } catch (_err: unknown) {
      setAuthError(
        `Gagal menyemak permohonan untuk pasukan "${cleanTeamName}". Sila semak semula maklumat.`
      );
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (scannedData: string) => {
    setShowCameraScanner(false);

    if (!registeredTeam) {
      Alert.alert('Ralat', 'Sila pilih pasukan anda terlebih dahulu.');
      return;
    }

    // Parse scanned HMAC QR payload
    // Format: `${teamId}:${eventId}:attendance:${timestamp}:${keyId}:${signature}`
    const parts = scannedData.split(':');
    const scannedTeamId = parts[0];

    // Verify team ID lock
    if (scannedTeamId && scannedTeamId !== '*' && scannedTeamId !== registeredTeam.id && scannedTeamId !== registeredTeam.name) {
      Alert.alert(
        'Kod QR Tidak Sah ⚠️',
        `Kod QR ini dijana khas untuk pasukan lain (ID: ${scannedTeamId}). Sila minta Urus Setia memaparkan Kod QR Pelepasan yang khusus untuk pasukan "${registeredTeam.name}".`
      );
      return;
    }

    // Persist attendance check-in to Firestore backend
    try {
      const eventId = activeEvent?.id || 'EV-001';
      await checkinTeamAttendance(eventId, registeredTeam.id);
    } catch (err) {
      console.warn('Scan checkin notice:', err);
    }

    // Log in user and navigate to StaggeredStartScreen
    login('participant', {
      id: `USR-${registeredTeam.id}`,
      name: registeredTeam.leaderName || registeredTeam.name,
      email: 'peserta@xplorequest.com',
      role: 'participant',
      teamId: registeredTeam.id,
    });

    navigation.reset({
      index: 0,
      routes: [{ name: 'StaggeredStart' }],
    });
  };

  const handleBack = () => {
    navigation.goBack();
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
          {status === 'input' && (
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
          )}

          {status === 'checkin' && (
            <View style={styles.checkinContainer}>
              {/* Top Back Button with Dashed Border */}
              <TouchableOpacity
                style={styles.dashedBackButton}
                onPress={() => setStatus('input')}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={18} color="#6B21A8" />
                <Text style={styles.dashedBackButtonText}>Kembali</Text>
              </TouchableOpacity>

              {/* Logo Box */}
              <View style={styles.logoCardBox}>
                <Image
                  source={require('../assets/XploreQuest_Icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              {/* Header Title */}
              <Text style={styles.checkinTitle}>Daftar Masuk Hari Acara</Text>

              {/* Scanner Box Card with Dashed Border */}
              <View style={styles.checkinDashedCard}>
                <Text style={styles.scanHeaderTitle}>Imbas QR Urus Setia</Text>
                
                <View style={styles.purpleScanIconCircle}>
                  <Ionicons name="scan-outline" size={48} color="#FFFFFF" />
                </View>
              </View>

              {/* Red/Pink Dashed Start Scan Button */}
              <TouchableOpacity
                style={styles.startScanDashedButton}
                onPress={() => setShowCameraScanner(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-outline" size={22} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.startScanDashedButtonText}>📷 Scan Attendance QR</Text>
              </TouchableOpacity>
            </View>
          )}



          {status === 'error' && (
            <View style={styles.centeredContainer}>
              <Card style={styles.statusCard} role="participant">
                <Ionicons name="alert-circle" size={64} color={COLORS.danger} style={{ marginBottom: 12 }} />
                <Badge label="PENDAFTARAN GAGAL" state="danger" style={styles.statusBadge} />
                <Text style={styles.statusTitle}>Ralat Pendaftaran</Text>
                <Text style={styles.statusSubtitle}>{authError}</Text>
                <TouchableOpacity
                  style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 24 }}
                  onPress={() => setStatus('input')}
                >
                  <Text style={{ color: COLORS.participant.primary, fontWeight: '700' }}>Cuba Semula</Text>
                </TouchableOpacity>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Real Camera QR Scanner Component */}
        <RealCameraQRScanner
          visible={showCameraScanner}
          title="Scan Attendance QR"
          subtitle="Halakan kamera ke Kod QR Kehadiran Urus Setia di Checkpoint Permulaan"
          onClose={() => setShowCameraScanner(false)}
          onScanSuccess={handleScanSuccess}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF5FF', // Light purple tint background matching UI photo
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  scrollContainer: {
    padding: SPACING.md,
    flexGrow: 1,
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.participant.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
  formCard: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
  },
  codeHighlight: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 2,
    color: COLORS.participant.primary,
  },
  submitBtn: {
    width: '100%',
    marginTop: SPACING.sm,
  },

  /* Checkin Day UI Styles (matching user screenshot) */
  checkinContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    width: '100%',
  },
  dashedBackButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#6B21A8',
    borderRadius: RADIUS.md,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: SPACING.lg,
    backgroundColor: '#F3E8FF',
  },
  dashedBackButtonText: {
    color: '#6B21A8',
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 13,
    marginLeft: 4,
  },
  logoCardBox: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E9D5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  logoImage: {
    width: 65,
    height: 65,
  },
  checkinTitle: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#1E1B4B',
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  checkinDashedCard: {
    width: '100%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C084FC',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  scanHeaderTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#4C1D95',
    marginBottom: SPACING.lg,
  },
  purpleScanIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7E22CE',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  startScanDashedButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#EF4444',
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  startScanDashedButtonText: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#DC2626',
  },

  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  statusCard: {
    width: '100%',
    padding: SPACING.xl,
    alignItems: 'center',
    textAlign: 'center',
  },
  pendingCard: {
    borderColor: COLORS.pending,
  },
  checkIconWrapper: {
    marginBottom: SPACING.md,
  },
  statusBadge: {
    marginBottom: SPACING.sm,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  teamDetailsCard: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  detailsHeader: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
});

