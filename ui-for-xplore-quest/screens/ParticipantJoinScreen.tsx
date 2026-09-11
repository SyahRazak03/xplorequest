import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Animated,
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
import { registerTeam } from '../services/teamService';
import type { Team } from '../mockData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParticipantJoin'>;

export default function ParticipantJoinScreen() {
  const navigation = useNavigation<NavigationProp>();

  // States: 'input' | 'scanning' | 'pending' | 'error'
  const [status, setStatus] = useState<'input' | 'scanning' | 'pending' | 'error'>('input');
  const [authError, setAuthError] = useState('');

  // Form Fields State
  const [eventCode, setEventCode] = useState('XT2026');
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [memberCount, setMemberCount] = useState('4');
  const [registeredTeam, setRegisteredTeam] = useState<Team | null>(null);

  // Animation value for simulated laser scan
  const laserAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'scanning') {
      // Loop laser animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Submit registration in background
      let isMounted = true;
      const count = parseInt(memberCount, 10) || 4;

      registerTeam(eventCode.trim(), {
        name: teamName.trim(),
        leaderName: leaderName.trim() || undefined,
        memberCount: count,
        joinCode: eventCode.trim().toUpperCase(),
      })
        .then((team) => {
          if (isMounted) {
            setRegisteredTeam(team);
            setStatus('pending');
          }
        })
        .catch((err: unknown) => {
          if (isMounted) {
            const msg = err instanceof Error ? err.message : 'Pendaftaran gagal.';
            setAuthError(msg);
            setStatus('error');
          }
        });

      return () => {
        isMounted = false;
        laserAnim.stopAnimation();
      };
    }
  }, [status, eventCode, teamName, leaderName, memberCount, laserAnim]);

  const handleStartSubmit = () => {
    if (!eventCode.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Kod Acara.');
      return;
    }
    if (!teamName.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Nama Kumpulan.');
      return;
    }
    const count = parseInt(memberCount, 10);
    if (isNaN(count) || count < 1 || count > 6) {
      Alert.alert('Ralat', 'Jumlah ahli mestilah antara 1 hingga 6 orang.');
      return;
    }

    setAuthError('');
    setStatus('scanning');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Interpolate laser position
  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 190],
  });

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
                <Text style={styles.title}>Daftar Kumpulan Baru</Text>
                <Text style={styles.subtitle}>
                  Sila masukkan kod acara dan butiran kumpulan anda untuk memulakan pendaftaran perlumbaan.
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

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NAMA KETUA PASUKAN</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: Ali bin Abu"
                    value={leaderName}
                    onChangeText={setLeaderName}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>JUMLAH AHLI KUMPULAN</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="4"
                    value={memberCount}
                    onChangeText={setMemberCount}
                    keyboardType="numeric"
                    maxLength={1}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                <PrimaryButton
                  label="Hantar Pendaftaran Kumpulan"
                  onPress={handleStartSubmit}
                  role="participant"
                  icon={<Ionicons name="paper-plane-outline" size={20} color={COLORS.textLight} />}
                  style={styles.submitBtn}
                />
              </Card>
            </View>
          )}

          {status === 'scanning' && (
            <View style={styles.centeredContainer}>
              <Text style={styles.scannerTitle}>Menghantar Pendaftaran Kumpulan...</Text>
              <Text style={styles.scannerSubtitle}>Menyemak kod acara dan mengesahkan maklumat</Text>

              {/* Viewfinder Animation Box */}
              <View style={styles.viewfinderContainer}>
                <View style={styles.viewfinder}>
                  <Animated.View style={[styles.laserLine, { transform: [{ translateY }] }]} />
                  <Ionicons name="scan" size={200} color="rgba(255,255,255,0.3)" style={styles.scanIcon} />
                </View>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStatus('input')}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'pending' && (
            <View style={styles.centeredContainer}>
              <Card style={[styles.statusCard, styles.pendingCard]} role="participant">
                <View style={styles.checkIconWrapper}>
                  <Ionicons name="time-outline" size={72} color={COLORS.pending} />
                </View>
                <Badge label="MENUNGGU KELULUSAN URUS SETIA" state="warning" style={styles.statusBadge} />
                <Text style={styles.statusTitle}>Pendaftaran Diterima!</Text>
                <Text style={styles.statusSubtitle}>
                  Permohonan kumpulan anda telah dihantar. Urus setia akan menyemak dan meluluskan pendaftaran sebelum perlumbaan bermula.
                </Text>

                {/* Team Info Details */}
                <View style={styles.teamDetailsCard}>
                  <Text style={styles.detailsHeader}>Maklumat Pendaftaran:</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nama Kumpulan:</Text>
                    <Text style={styles.detailValue}>{registeredTeam?.name || teamName}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ketua Pasukan:</Text>
                    <Text style={styles.detailValue}>{registeredTeam?.leaderName || leaderName || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Jumlah Ahli:</Text>
                    <Text style={styles.detailValue}>{registeredTeam?.memberCount || memberCount} Orang</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status Pendaftaran:</Text>
                    <Text style={[styles.detailValue, { color: COLORS.pending }]}>Tertunda (Pending)</Text>
                  </View>
                </View>

                <PrimaryButton
                  label="Kembali ke Laman Utama"
                  onPress={handleBack}
                  role="participant"
                  variant="outline"
                  style={{ width: '100%', marginTop: SPACING.lg }}
                />
              </Card>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  scannerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: SPACING.xl,
  },
  viewfinderContainer: {
    width: 250,
    height: 250,
    borderRadius: RADIUS.md,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.participant.primary,
    ...SHADOWS.md,
  },
  viewfinder: {
    width: 200,
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  scanIcon: {
    position: 'absolute',
  },
  cancelBtn: {
    marginTop: SPACING.xl,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  cancelBtnText: {
    color: COLORS.danger,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 14,
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
