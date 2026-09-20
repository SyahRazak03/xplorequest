import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Checkpoint } from '../mockData';
import { useApp } from '../AppContext';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import PendingBlockedModal from './PendingBlockedModal';
import CelebrationModal from './CelebrationModal';
import QRScanSimulationScreen from './QRScanSimulationScreen';
import { Card, Badge, StarBurst } from '../components';

const { width } = Dimensions.get('window');

type FinishLineScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FinishLine'>;
type FinishLineScreenRouteProp = RouteProp<RootStackParamList, 'FinishLine'>;

export default function FinishLineScreen() {
  const navigation = useNavigation<FinishLineScreenNavigationProp>();
  const route = useRoute<FinishLineScreenRouteProp>();
  const { checkpoints: appCheckpoints, activeEvent } = useApp();
  
  // Extract parameters from route
  const { completedCps = [], skippedCps = [], points = 250, elapsedTime = 5075 } = route.params || {};

  const theme = getThemeForRole('participant');

  // Local state copy of race timers
  const [localTimer, setLocalTimer] = useState(elapsedTime);
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [pendingCpForWarning, setPendingCpForWarning] = useState<any>(null);

  // Pulse animation for scan button
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTimer((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Pulse animation looping
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [
      h > 9 ? h : `0${h}`,
      m > 9 ? m : `0${m}`,
      s > 9 ? s : `0${s}`,
    ].join(':');
  };

  const handleScanFinishQR = () => {
    // Check if any of the non-finish/non-start CPs are not completed
    const requiredCps = appCheckpoints.filter((cp) => !cp.isFinish && !cp.isStart);
    const firstPending = requiredCps.find((cp) => !completedCps.includes(cp.id));

    if (firstPending) {
      // Gatekeeper Blocks: Show warning modal
      setPendingCpForWarning(firstPending);
      setBlockedModalVisible(true);
    } else {
      // Allowed: Launch camera simulation for CP-TAMAT
      setScannerVisible(true);
    }
  };

  const handleScanSuccess = () => {
    // Imbasan Berjaya: Hide scanner and show celebration
    setScannerVisible(false);
    
    // We add 300 points for CP-TAMAT completion
    setTimeout(() => {
      setCelebrationVisible(true);
    }, 400);
  };


  const navigateToResults = () => {
    setCelebrationVisible(false);
    navigation.navigate('PersonalResults', {
      finalPoints: points + 300, // Include CP score points
      elapsedTime: localTimer,
    });
  };

  // Get status of a checkpoint for visualization list
  const getCpStatusLabel = (cpId: string) => {
    if (completedCps.includes(cpId)) return 'SELESAI';
    if (skippedCps.includes(cpId)) return 'TERTUNDA';
    return 'TERKUNCI';
  };

  const getCpStatusColor = (cpId: string) => {
    if (completedCps.includes(cpId)) return COLORS.success;
    if (skippedCps.includes(cpId)) return COLORS.pending;
    return COLORS.textMuted;
  };

  const finishCp: Checkpoint = appCheckpoints.find(cp => cp.isFinish) || {
    id: 'CP-TAMAT',
    name: 'Astaka Garisan Penamat',
    latitude: 3.178,
    longitude: 101.7068,
    clueText: '',
    taskDescription: '',
    scorePoints: 300,
    statusPerTeam: {},
    isFinish: true,
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>Garisan Penamat</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Flag Icon Graphic banner */}
        <View style={styles.iconContainer}>
          <View style={[styles.outerRing, { borderColor: theme.colors.primaryLight }]}>
            <View style={[styles.innerRing, { backgroundColor: theme.colors.primaryLight }]}>
              <Ionicons name="flag" size={54} color={theme.colors.primary} />
            </View>
          </View>
        </View>

        {/* CP Info Block */}
        <View style={styles.infoCard}>
          <Text style={[styles.cpCode, { color: theme.colors.accent }]}>POS CP-AKHIR</Text>
          <Text style={[styles.cpTitle, { color: theme.colors.text }]}>{finishCp.name}</Text>
          
          <View style={styles.divider} />

          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.detailText}>{activeEvent?.locationName || 'Lokasi Acara'}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.detailText}>
              Masa Terkumpul: <Text style={{ fontWeight: '700' }}>{formatTime(localTimer)}</Text>
            </Text>
          </View>
        </View>

        {/* Scan Actions */}
        <View style={styles.actionContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
              onPress={handleScanFinishQR}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
              <Text style={styles.scanBtnText}>Daftar Masuk Penamat</Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.actionHint}>
            Sila imbas kod QR Marshal Utama di astaka penamat untuk menamatkan perlumbaan secara rasmi.
          </Text>
        </View>

        {/* Checkpoint checklist overview card */}
        <Card role="participant" title="Status Senarai Semak Pasukan" style={styles.checklistCard}>
          <Text style={styles.checklistSubtitle}>
            Semua checkpoint terdahulu mestilah bertanda hijau (Selesai) sebelum pendaftaran masuk dibenarkan.
          </Text>
          <View style={styles.checklistGrid}>
            {appCheckpoints.filter(cp => !cp.isFinish).map((cp, idx) => {
              const status = getCpStatusLabel(cp.id);
              const color = getCpStatusColor(cp.id);
              return (
                <View key={cp.id} style={styles.checklistItem}>
                  <View style={styles.checkpointBullet}>
                    <Text style={styles.bulletText}>CP{idx+1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checklistCpName} numberOfLines={1}>
                      {cp.name}
                    </Text>
                    <Text style={[styles.checklistStatusText, { color }]}>
                      {status}
                    </Text>
                  </View>
                  {status === 'SELESAI' ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                  ) : status === 'TERTUNDA' ? (
                    <Ionicons name="alert-circle" size={22} color={COLORS.pending} />
                  ) : (
                    <Ionicons name="lock-closed" size={20} color={COLORS.textMuted} />
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      </ScrollView>

      {/* Blocked Gatekeeper Warning Modal */}
      <PendingBlockedModal
        visible={blockedModalVisible}
        pendingCheckpoint={pendingCpForWarning}
        onClose={() => setBlockedModalVisible(false)}
      />

      {/* Camera/QR Scanner Simulation screen */}
      <QRScanSimulationScreen
        visible={scannerVisible}
        checkpoint={finishCp}
        onClose={() => setScannerVisible(false)}
        onScanSuccess={handleScanSuccess}
      />


      {/* Celebration animation screen */}
      <CelebrationModal
        visible={celebrationVisible}
        onViewResults={navigateToResults}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.h3,
    fontWeight: '800',
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  scrollContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.lg,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  outerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  cpCode: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  cpTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    width: '100%',
    marginBottom: SPACING.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: 4,
    width: '100%',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scanBtn: {
    width: '100%',
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 16,
  },
  checklistCard: {
    width: '100%',
  },
  checklistSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 16,
  },
  checklistGrid: {
    gap: SPACING.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: SPACING.sm,
  },
  checkpointBullet: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulletText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text,
  },
  checklistCpName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  checklistStatusText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
