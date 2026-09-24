import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Card, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { checkinTeamAttendance } from '../services/teamService';
import type { Team } from '../types';
import { useApp } from '../AppContext';
import RealCameraQRScanner from '../components/RealCameraQRScanner';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParticipantAttendanceScan'>;

export default function ParticipantAttendanceScanScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, activeEvent, teams, checkpoints, isRaceStarted, logout } = useApp();
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Derive authenticated team account details from AppContext / Firestore
  const currentTeam: Team | null = (teams || []).find(
    (t) => (user?.teamId && t.id === user.teamId) || (user?.name && (t.name === user.name || t.leaderName === user.name))
  ) || null;

  // Auto-redirect already checked-in teams to StaggeredStart or Dashboard
  React.useEffect(() => {
    if (currentTeam && (currentTeam.isPresent === true || currentTeam.attendanceStatus === 'present')) {
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
    }
  }, [currentTeam, isRaceStarted, navigation]);

  const handleScanSuccess = async (scannedData: string) => {
    setShowCameraScanner(false);

    if (!currentTeam) {
      Alert.alert('Ralat', 'Maklumat pasukan tidak ditemui dalam sesi log masuk.');
      return;
    }

    // Parse scanned HMAC QR payload
    // Format: `${teamId}:${eventId}:attendance:${timestamp}:${keyId}:${signature}`
    const parts = scannedData.split(':');
    const scannedTeamId = parts[0];

    // Verify team ID lock
    if (scannedTeamId && scannedTeamId !== '*' && scannedTeamId !== currentTeam.id && scannedTeamId !== currentTeam.name) {
      Alert.alert(
        'Kod QR Tidak Sah ⚠️',
        `Kod QR ini dijana khas untuk pasukan lain (ID: ${scannedTeamId}). Sila minta Urus Setia memaparkan Kod QR Pelepasan yang khusus untuk pasukan "${currentTeam.name}".`
      );
      return;
    }

    // Persist attendance check-in to Firestore backend
    try {
      const eventId = activeEvent?.id || user?.eventId || 'EV-001';
      const startCP = (checkpoints || []).find((c: any) => c.isStart || c.type === 'start') || checkpoints?.[0];
      const startCpId = startCP?.id || 'CP-START';
      const startPoints = startCP?.scorePoints || 0;
      await checkinTeamAttendance(eventId, currentTeam.id, startCpId, startPoints);
    } catch (err) {
      console.warn('Scan checkin notice:', err);
    }

    // Reset navigation to StaggeredStartScreen
    navigation.reset({
      index: 0,
      routes: [{ name: 'StaggeredStart' }],
    });
  };

  const handleLogout = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'ParticipantJoin' }],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.checkinContainer}>
          {/* Top Back / Logout Button with Dashed Border */}
          <TouchableOpacity
            style={styles.dashedBackButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#6B21A8" />
            <Text style={styles.dashedBackButtonText}>Tukar Akaun / Kembali</Text>
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

          {/* Authenticated Team Account Card */}
          {currentTeam && (
            <Card style={styles.teamAccountCard} role="participant">
              <View style={styles.teamHeaderRow}>
                <View>
                  <Text style={styles.teamNameText}>{currentTeam.name}</Text>
                  <Text style={styles.teamIdText}>ID Pasukan: {currentTeam.id}</Text>
                </View>
                <Badge label="AKAUN AKTIF" state="success" />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ketua Pasukan:</Text>
                  <Text style={styles.detailValue}>{currentTeam.leaderName || 'Diisi dalam Borang Web'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>No. Telefon:</Text>
                  <Text style={styles.detailValue}>{currentTeam.phone || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jumlah Ahli:</Text>
                  <Text style={styles.detailValue}>{currentTeam.memberCount || 4} Orang</Text>
                </View>
                {currentTeam.membersList ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Senarai Ahli:</Text>
                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right', marginLeft: 8 }]}>
                      {currentTeam.membersList}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          )}

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
      </ScrollView>

      {/* Real Camera QR Scanner Component */}
      <RealCameraQRScanner
        visible={showCameraScanner}
        title="Scan Attendance QR"
        subtitle="Halakan kamera ke Kod QR Kehadiran Urus Setia di Checkpoint Permulaan"
        onClose={() => setShowCameraScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF5FF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  checkinContainer: {
    alignItems: 'center',
    width: '100%',
  },
  dashedBackButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: '#7E22CE',
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  dashedBackButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B21A8',
  },
  logoCardBox: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.lg,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    ...SHADOWS.sm,
  },
  logoImage: {
    width: 58,
    height: 58,
  },
  checkinTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3B0764',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  teamAccountCard: {
    width: '100%',
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderColor: '#E9D5FF',
  },
  teamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  teamIdText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3E8FF',
    marginVertical: SPACING.sm,
  },
  detailsGrid: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  checkinDashedCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: '#C084FC',
    borderStyle: 'dashed',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  scanHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4C1D95',
    marginBottom: SPACING.lg,
  },
  purpleScanIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderStyle: 'dashed',
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...SHADOWS.sm,
  },
  startScanDashedButtonText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 16,
  },
});
