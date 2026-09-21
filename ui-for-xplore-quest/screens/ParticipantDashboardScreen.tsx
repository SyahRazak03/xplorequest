import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  Image,
  Platform,
  StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../AppContext';
import { Checkpoint, CheckpointStatus } from '../types';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { Card, Badge, ProgressBar, CheckpointListItem, ToastNotification, OfflineStatusChip } from '../components';

import CheckpointDetailScreen from './CheckpointDetailScreen';
import MapScreen from './MapScreen';
import QRScanSimulationScreen from './QRScanSimulationScreen';

const { width } = Dimensions.get('window');

type TabType = 'dashboard' | 'map' | 'scan' | 'profile';

export default function ParticipantDashboardScreen() {
  const { user, theme, logout, rules, isRaceStarted, raceStartTime, checkpoints, activeEvent, teams } = useApp();

  const activeTheme = getThemeForRole('participant');
  const navigation = useNavigation<any>();

  // Find logged-in participant's team
  const currentTeam = (teams || []).find(
    (t) => (user?.teamId && t.id === user.teamId) || (user?.name && (t.name === user.name || t.leaderName === user.name))
  ) || (teams && teams.length > 0 ? teams[0] : null);

  const currentTeamIndex = currentTeam ? (teams || []).findIndex((t) => t.id === currentTeam.id) : 0;
  const safeTeamIndex = currentTeamIndex >= 0 ? currentTeamIndex : 0;

  const rawCheckpoints: Checkpoint[] = (checkpoints && checkpoints.length > 0)
    ? checkpoints
    : [
        { id: 'CP-START', name: 'GATE 3', latitude: 3.172, longitude: 101.7, clueText: 'Pos Mula Attendance', taskDescription: 'Imbas QR Attendance', scorePoints: 0, statusPerTeam: {}, isStart: true },
        { id: 'CP-001', name: '255', latitude: 3.173, longitude: 101.71, clueText: 'Checkpoint 255', taskDescription: 'Selesaikan cabaran 255', scorePoints: 10, statusPerTeam: {}, isStart: false, isFinish: false },
        { id: 'CP-002', name: '256', latitude: 3.174, longitude: 101.72, clueText: 'Checkpoint 256', taskDescription: 'Selesaikan cabaran 256', scorePoints: 10, statusPerTeam: {}, isStart: false, isFinish: false },
        { id: 'CP-END', name: 'GATE 2', latitude: 3.175, longitude: 101.73, clueText: 'Garisan Penamat', taskDescription: 'Pelepasan Tamat', scorePoints: 20, statusPerTeam: {}, isFinish: true },
      ];

  const startCP = rawCheckpoints.find((cp: Checkpoint) => cp.isStart || (cp as any).type === 'start') || rawCheckpoints[0];
  const finishCP = rawCheckpoints.find((cp: Checkpoint) => cp.isFinish || (cp as any).type === 'finish') || rawCheckpoints[rawCheckpoints.length - 1];
  const normalCPs = rawCheckpoints.filter((cp: Checkpoint) => 
    cp.id !== startCP?.id && cp.id !== finishCP?.id && !cp.isStart && !cp.isFinish
  );

  const assignedNormalIndex = normalCPs.length > 0 ? (safeTeamIndex % normalCPs.length) : 0;
  const assignedNormalCP = normalCPs.length > 0 ? normalCPs[assignedNormalIndex] : null;

  // -------------------------------------------------------------
  // 1. Race States
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedCps, setCompletedCps] = useState<string[]>([]);
  const [skippedCps, setSkippedCps] = useState<string[]>([]);
  const [currentCpId, setCurrentCpId] = useState<string>('');
  const [points, setPoints] = useState(0);

  // Auto mark Start Checkpoint as completed (Attendance QR scanned)
  useEffect(() => {
    if (startCP && !completedCps.includes(startCP.id)) {
      setCompletedCps(prev => Array.from(new Set([...prev, startCP.id])));
    }
  }, [startCP?.id]);

  // Auto set active checkpoint to team's assigned initial normal CP
  useEffect(() => {
    if (assignedNormalCP && !currentCpId && !completedCps.includes(assignedNormalCP.id)) {
      setCurrentCpId(assignedNormalCP.id);
    }
  }, [assignedNormalCP?.id, currentCpId]);

  // Checkpoint Detail Modal states
  const [selectedCpForDetail, setSelectedCpForDetail] = useState<Checkpoint | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Toast Notification states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'info'>('info');

  const triggerToast = (message: string, type: 'success' | 'warning' | 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };
  
  // QR Scan simulation modal states
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [qrSimVisible, setQrSimVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  
  // Animation for scanner line
  const scannerAnim = useRef(new Animated.Value(0)).current;

  // -------------------------------------------------------------
  // 2. Stopwatch Timer Effect (Derived from raceStartTime)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isRaceStarted || !raceStartTime) {
      setElapsedTime(0);
      return;
    }

    const updateTimer = () => {
      const secondsPassed = Math.floor((Date.now() - raceStartTime) / 1000);
      setElapsedTime(secondsPassed > 0 ? secondsPassed : 0);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [isRaceStarted, raceStartTime]);

  // Format stopwatch: hh:mm:ss
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

  // -------------------------------------------------------------
  // 3. Scan & Skip Logic Helpers (Cyclical Route Calculation)
  // -------------------------------------------------------------
  const getOrderedCheckpoints = () => {
    if (normalCPs.length === 0) return rawCheckpoints;

    const orderedNormal = [
      ...normalCPs.slice(assignedNormalIndex),
      ...normalCPs.slice(0, assignedNormalIndex),
    ];

    const result: Checkpoint[] = [];
    if (startCP) result.push(startCP);
    result.push(...orderedNormal);
    if (finishCP) result.push(finishCP);
    return result;
  };

  const orderedCheckpoints = getOrderedCheckpoints();

  const canFinish = orderedCheckpoints
    .filter(cp => cp.id !== finishCP?.id && !cp.isFinish && cp.id !== 'CP-TAMAT')
    .every(cp => completedCps.includes(cp.id) || skippedCps.includes(cp.id));

  const getCheckpointStatus = (cpId: string): CheckpointStatus => {
    if (completedCps.includes(cpId)) return 'completed';
    if (skippedCps.includes(cpId)) return 'pending';
    if (currentCpId === cpId) return 'active';
    return 'locked';
  };

  const [cpIdBeingScanned, setCpIdBeingScanned] = useState<string>('');

  const openCheckpointDetail = (checkpoint: Checkpoint) => {
    if (checkpoint.isFinish || checkpoint.id === finishCP?.id || checkpoint.id === 'CP-TAMAT') {
      if (!canFinish) {
        Alert.alert(
          'Akses Dihalang',
          'Anda belum menyelesaikan semua pos kawalan! Sila selesaikan semua pos kawalan sebelum mendaftar masuk di Garisan Penamat.'
        );
        return;
      }
      navigation.navigate('FinishLine', {
        completedCps,
        skippedCps,
        points,
        elapsedTime,
      });
      return;
    }
    setSelectedCpForDetail(checkpoint);
    setDetailModalVisible(true);
  };

  const handleSkipCheckpoint = (cpId?: string) => {
    const targetCpId = cpId || currentCpId;
    const currentCpIndex = orderedCheckpoints.findIndex((cp) => cp.id === targetCpId);
    if (currentCpIndex === -1 || currentCpIndex >= orderedCheckpoints.length - 1) {
      Alert.alert('Info', 'Anda berada di checkpoint terakhir. Tidak boleh langkau.');
      return;
    }

    const nextCp = orderedCheckpoints[currentCpIndex + 1];
    
    // Add target to skipped CPs
    setSkippedCps((prev) => {
      if (!prev.includes(targetCpId)) {
        return [...prev, targetCpId];
      }
      return prev;
    });

    // Advance active pointer to next CP
    setCurrentCpId(nextCp.id);
    
    // Toast feedback using standard display index
    const displayIndex = checkpoints.filter((cp: Checkpoint) => !cp.isStart && !cp.isFinish).indexOf(orderedCheckpoints[currentCpIndex]) + 1;
    triggerToast(`Pos CP-${displayIndex} ditangguhkan. Aktif: ${nextCp.name}`, 'warning');

  };


  const handleSimulateScan = (targetCpId?: string) => {
    const cpIdToScan = targetCpId || currentCpId;
    if (cpIdToScan === 'CP-TAMAT') {
      if (!canFinish) {
        Alert.alert(
          'Akses Dihalang',
          'Anda belum menyelesaikan semua pos kawalan! Sila selesaikan semua pos CP-01 hingga CP-06 sebelum mendaftar masuk di Garisan Penamat.'
        );
        return;
      }
      navigation.navigate('FinishLine', {
        completedCps,
        skippedCps,
        points,
        elapsedTime,
      });
      return;
    }
    const targetCp = orderedCheckpoints.find((cp: Checkpoint) => cp.id === cpIdToScan);
    if (!targetCp) {
      Alert.alert('Cabaran Tamat', 'Tiada checkpoint aktif untuk diimbas.');
      return;
    }

    setCpIdBeingScanned(cpIdToScan);
    setQrSimVisible(true);
  };

  const handleScanCompleted = (cpIdToScan: string) => {
    const targetCp = orderedCheckpoints.find((cp: Checkpoint) => cp.id === cpIdToScan);
    if (!targetCp) return;

    const pointsEarned = targetCp.scorePoints;
    setPoints((prev) => prev + pointsEarned);
    
    // Add to completed list
    setCompletedCps((prev) => {
      if (!prev.includes(cpIdToScan)) {
        return [...prev, cpIdToScan];
      }
      return prev;
    });

    // Remove from skipped list if it was pending
    setSkippedCps((prev) => prev.filter((id) => id !== cpIdToScan));
    
    const currentCpIndex = orderedCheckpoints.findIndex((cp: Checkpoint) => cp.id === cpIdToScan);

    if (cpIdToScan === currentCpId) {
      if (currentCpIndex < orderedCheckpoints.length - 1) {
        const nextCp = orderedCheckpoints[currentCpIndex + 1];
        setCurrentCpId(nextCp.id);
        const displayIndex = checkpoints.filter((cp: Checkpoint) => !cp.isStart && !cp.isFinish).indexOf(targetCp) + 1;
        triggerToast(`Imbasan berjaya! CP-${displayIndex} selesai. Aktif: ${nextCp.name}`, 'success');
      } else {
        // Finished the entire race!
        setCurrentCpId('');
        triggerToast(`Tamat Cabaran! Tahniah pasukan anda berjaya menyelesaikan cabaran!`, 'success');
      }
    } else {
      // Tapped a pending checkpoint to complete it
      const displayIndex = checkpoints.filter((cp: Checkpoint) => !cp.isStart && !cp.isFinish).indexOf(targetCp) + 1;
      triggerToast(`Imbasan berjaya! CP-${displayIndex} diselesaikan daripada status tertunda.`, 'success');
    }

    // Auto navigate to dashboard tab
    setActiveTab('dashboard');
  };

  const handleManualCodeSubmit = () => {
    if (!manualCode.trim()) return;
    
    const cpIdToScan = cpIdBeingScanned || currentCpId;
    const targetCp = orderedCheckpoints.find((cp: Checkpoint) => cp.id === cpIdToScan);
    if (!targetCp) return;

    if (manualCode.toUpperCase() === `PASS${cpIdToScan.replace('-', '')}`) {
      setManualCode('');
      setScanModalVisible(false);
      
      const pointsEarned = targetCp.scorePoints;
      setPoints((prev) => prev + pointsEarned);
      
      // Add to completed list
      setCompletedCps((prev) => {
        if (!prev.includes(cpIdToScan)) {
          return [...prev, cpIdToScan];
        }
        return prev;
      });

      // Remove from skipped list
      setSkippedCps((prev) => prev.filter((id) => id !== cpIdToScan));
      
      const currentCpIndex = orderedCheckpoints.findIndex((cp: Checkpoint) => cp.id === cpIdToScan);

      if (cpIdToScan === currentCpId) {
        if (currentCpIndex < orderedCheckpoints.length - 1) {
          const nextCp = orderedCheckpoints[currentCpIndex + 1];
          setCurrentCpId(nextCp.id);
          const displayIndex = checkpoints.filter((cp: Checkpoint) => !cp.isStart && !cp.isFinish).indexOf(targetCp) + 1;
          triggerToast(`Kod sah! CP-${displayIndex} selesai. Aktif: ${nextCp.name}`, 'success');
        } else {
          setCurrentCpId('');
          triggerToast(`Tamat Cabaran! Tahniah pasukan anda berjaya menyelesaikan cabaran!`, 'success');
        }
      } else {
        const displayIndex = checkpoints.filter((cp: Checkpoint) => !cp.isStart && !cp.isFinish).indexOf(targetCp) + 1;
        triggerToast(`Kod sah! CP-${displayIndex} diselesaikan daripada status tertunda.`, 'success');
      }
    } else {
      Alert.alert('Kod Tidak Sah', 'Sila minta kod laluan manual yang betul daripada Marshal bertugas.');
    }
  };


  // Calculate percentage progress using orderedCheckpoints list
  const progressPercent = (completedCps.length / orderedCheckpoints.length) * 100;


  // -------------------------------------------------------------
  // 4. View Renderers
  // -------------------------------------------------------------

  // Tab 1: Dashboard Content
  const renderDashboardTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Main Stats Header */}
        <View style={[styles.statsGrid, { gap: activeTheme.spacing.md }]}>
          <View style={[styles.statBox, !rules.pointsSystemEnabled && { flex: 1, width: '100%' }, { backgroundColor: activeTheme.colors.card, borderColor: activeTheme.colors.border, borderWidth: 1, ...activeTheme.shadows.sm }]}>
            <View style={styles.statIconHeader}>
              <Ionicons name="time-outline" size={20} color={activeTheme.colors.primary} />
              <Text style={[styles.statLabel, { color: activeTheme.colors.textMuted }]}>Masa Berjalan</Text>
            </View>
            <Text style={[styles.statValue, { color: activeTheme.colors.text }]}>
              {formatTime(elapsedTime)}
            </Text>
          </View>

          {rules.pointsSystemEnabled && (
            <View style={[styles.statBox, { backgroundColor: activeTheme.colors.card, borderColor: activeTheme.colors.border, borderWidth: 1, ...activeTheme.shadows.sm }]}>
              <View style={styles.statIconHeader}>
                <Ionicons name="trophy-outline" size={20} color={activeTheme.colors.accent} />
                <Text style={[styles.statLabel, { color: activeTheme.colors.textMuted }]}>Jumlah Mata</Text>
              </View>
              <Text style={[styles.statValue, { color: activeTheme.colors.text }]}>
                {points} Pts
              </Text>
            </View>
          )}
        </View>


        {/* Progress Tracker Card */}
        <Card role="participant" borderAccent="left" title="Kemajuan Laluan Kumpulan">
          <View style={styles.progressRow}>
            <Text style={[styles.progressText, { color: activeTheme.colors.text }]}>
              {completedCps.length} daripada {orderedCheckpoints.length} Checkpoint Selesai
            </Text>
            {skippedCps.length > 0 && (
              <Badge label={`${skippedCps.length} Dilangkau`} state="warning" />
            )}
          </View>
          <ProgressBar progress={progressPercent} role="participant" style={{ marginTop: 8 }} />
        </Card>

        {/* Garisan Penamat Gateway Card */}
        <Card
          role="participant"
          style={{ borderColor: activeTheme.colors.primary, borderWidth: 1, marginTop: 12 }}
          title="Daftar Masuk Garisan Penamat"
          headerRight={<Badge label="Pintu TAMAT" state="info" />}
        >
          <Text style={{ fontSize: 13, color: activeTheme.colors.textMuted, marginBottom: 12, lineHeight: 18 }}>
            Sedia untuk menamatkan acara? Pendaftaran garisan penamat memerlukan semua checkpoint CP 1 hingga CP 6 diselesaikan terlebih dahulu.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: canFinish ? activeTheme.colors.primary : '#E2E8F0',
              borderRadius: activeTheme.radius.sm,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              ...activeTheme.shadows.sm,
            }}
            onPress={() => {
              if (!canFinish) {
                Alert.alert(
                  'Akses Dihalang',
                  'Anda belum menyelesaikan semua pos kawalan! Sila selesaikan semua pos CP 1 hingga CP 6 sebelum mendaftar masuk di Garisan Penamat.'
                );
                return;
              }
              navigation.navigate('FinishLine', {
                completedCps,
                skippedCps,
                points,
                elapsedTime,
              });
            }}
            activeOpacity={canFinish ? 0.8 : 1}
          >
            <Ionicons name="flag" size={16} color={canFinish ? '#FFFFFF' : '#94A3B8'} />
            <Text style={{ color: canFinish ? '#FFFFFF' : '#94A3B8', fontWeight: '700', fontSize: 14 }}>
              {canFinish ? 'Pergi ke Garisan Penamat' : 'Laluan Belum Selesai (Terkunci)'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={canFinish ? '#FFFFFF' : '#94A3B8'} />
          </TouchableOpacity>
        </Card>

        {/* Active Checkpoint Instruction Pane */}
        {currentCpId ? (
          (() => {
            const currentCp = orderedCheckpoints.find((cp: Checkpoint) => cp.id === currentCpId);
            if (!currentCp) return null;
            const displayIndex = checkpoints.filter((cp: Checkpoint) => !cp.isStart && !cp.isFinish).indexOf(currentCp) + 1;
            return (



              <Card
                role="participant"
                style={[styles.activeCpCard, { borderColor: activeTheme.colors.primary, borderWidth: 1 }]}
                title={currentCp.isStart ? 'Checkpoint Aktif: MULA' : currentCp.isFinish ? 'Checkpoint Aktif: TAMAT' : `Checkpoint Aktif: CP ${displayIndex}`}

                headerRight={<Badge label="Sila Ke Sini" state="warning" />}
              >
                <Text style={[styles.activeCpName, { color: activeTheme.colors.text }]}>
                  {currentCp.name}
                </Text>
                
                <View style={[styles.activeCpDetailItem, { marginTop: 12 }]}>
                  <Ionicons name="bulb-outline" size={18} color={activeTheme.colors.accent} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activeCpDetailLabel, { color: activeTheme.colors.accent }]}>Petunjuk Lokasi</Text>
                    <Text style={[styles.activeCpDetailVal, { color: activeTheme.colors.text }]}>{currentCp.clueText}</Text>
                  </View>
                </View>

                <View style={[styles.activeCpDetailItem, { marginTop: 12 }]}>
                  <Ionicons name="checkbox-outline" size={18} color={activeTheme.colors.primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activeCpDetailLabel, { color: activeTheme.colors.primary }]}>Tugasan Pos</Text>
                    <Text style={[styles.activeCpDetailVal, { color: activeTheme.colors.text }]}>{currentCp.taskDescription}</Text>
                  </View>
                </View>

                <View style={styles.activeActionsContainer}>
                  <TouchableOpacity
                    style={[styles.skipBtn, { borderColor: COLORS.border, borderWidth: 1 }]}
                    onPress={() => handleSkipCheckpoint(currentCp.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-redo-outline" size={16} color={COLORS.danger} />
                    <Text style={[styles.skipBtnText, { color: COLORS.danger }]}>Langkau (Congested)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.scanBtnAction, { backgroundColor: activeTheme.colors.primary }]}
                    onPress={() => handleSimulateScan(currentCp.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.scanBtnActionText}>Imbas QR Marshal</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.viewDetailBtn,
                    {
                      borderColor: activeTheme.colors.primary,
                      borderWidth: 1,
                      borderRadius: activeTheme.radius.sm,
                      marginTop: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      gap: 6,
                    },
                  ]}
                  onPress={() => openCheckpointDetail(currentCp)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={16} color={activeTheme.colors.primary} />
                  <Text style={{ color: activeTheme.colors.primary, fontWeight: '700', fontSize: 12 }}>
                    Lihat Landmark & Butiran
                  </Text>
                </TouchableOpacity>
              </Card>
            );
          })()

        ) : (
          <Card role="participant" borderAccent="left" title="Cabaran Tamat!">
            <View style={styles.finishContainer}>
              <Ionicons name="flag" size={48} color={activeTheme.colors.primary} />
              <Text style={[styles.finishTitle, { color: activeTheme.colors.text }]}>Cabaran Selesai! 🏁</Text>
              <Text style={[styles.finishSubtitle, { color: activeTheme.colors.textMuted }]}>
                Sila ke Pentas Utama / Astaka Urus Setia untuk pengesahan keputusan rasmi.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: activeTheme.colors.primary,
                  borderRadius: activeTheme.radius.sm,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  marginTop: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPress={() =>
                  navigation.navigate('PersonalResults', {
                    finalPoints: points,
                    elapsedTime: elapsedTime,
                  })
                }
                activeOpacity={0.8}
              >
                <Ionicons name="stats-chart" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Lihat Keputusan Penamat</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Pending Checkpoints (Skipped) Section */}
        {skippedCps.length > 0 && (
          <Card
            role="participant"
            style={[styles.pendingCard, { borderColor: activeTheme.colors.warning, borderWidth: 1 }]}
            title="Senarai Checkpoint Tertunda"
            headerRight={<Badge label={`${skippedCps.length} Tertunda`} state="warning" />}
          >
            <Text style={[styles.pendingDescription, { color: activeTheme.colors.textMuted }]}>
              Anda telah melangkau checkpoint ini kerana kesesakan. Sila kembali ke lokasi ini apabila keadaan mengizinkan untuk menyelesaikan tugasan.
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {checkpoints
                .filter((cp: Checkpoint) => skippedCps.includes(cp.id))
                .map((cp: Checkpoint) => {
                  const displayIndex = checkpoints.filter((c: Checkpoint) => !c.isStart && !c.isFinish).indexOf(cp) + 1;
                  return (
                    <TouchableOpacity
                      key={cp.id}
                      style={[
                        styles.pendingItemRow,
                        {
                          backgroundColor: '#FEF3C7',
                          borderColor: '#FDE68A',
                          borderWidth: 1,
                          borderRadius: activeTheme.radius.sm,
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      ]}
                      onPress={() => openCheckpointDetail(cp)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="alert-circle" size={18} color={activeTheme.colors.warning} />
                        <Text style={{ fontWeight: '700', fontSize: 13, color: activeTheme.colors.text }}>
                          {cp.isStart ? 'MULA' : cp.isFinish ? 'TAMAT' : `CP ${displayIndex}`}: {cp.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, color: activeTheme.colors.primary, fontWeight: '700' }}>
                          Kembali
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={activeTheme.colors.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </Card>
        )}

        {/* Scrollable Checkpoint Roadmap List */}
        <View style={styles.listContainer}>
          <Text style={[styles.listHeaderTitle, { color: activeTheme.colors.text }]}>
            Senarai Semak Laluan Acara
          </Text>
          {orderedCheckpoints.map((cp: Checkpoint) => {
            const displayIndex = checkpoints.filter((c: Checkpoint) => !c.isStart && !c.isFinish).indexOf(cp) + 1;
            return (
              <CheckpointListItem
                key={cp.id}
                checkpoint={cp}
                status={getCheckpointStatus(cp.id)}
                index={cp.isStart || cp.isFinish ? 0 : displayIndex}
                onPressScan={() => handleSimulateScan(cp.id)}
                onPressMap={() => setActiveTab('map')}
                onPressDetail={() => openCheckpointDetail(cp)}
              />
            );
          })}
        </View>

      </ScrollView>
    );
  };


  // Tab 2: Map View Content
  const renderMapTab = () => {
    return (
      <MapScreen
        completedCps={completedCps}
        skippedCps={skippedCps}
        currentCpId={currentCpId}
        points={points}
        onPressScan={handleSimulateScan}
        onPressDetail={openCheckpointDetail}
        getCheckpointStatus={getCheckpointStatus}
        setCurrentCpId={setCurrentCpId}
        setCompletedCps={setCompletedCps}
        setPoints={setPoints}
      />
    );
  };

  // Tab 3: Mock QR Scan View Content
  const renderScanTab = () => {
    return (
      <View style={styles.scannerTabContainer}>
        <View style={styles.scannerHeader}>
          <Text style={[styles.scannerTitle, { color: activeTheme.colors.text }]}>Imbas Kod QR Pos</Text>
          <Text style={[styles.scannerSubtitle, { color: activeTheme.colors.textMuted }]}>
            Halakan kamera pada kod QR Marshal di checkpoint aktif.
          </Text>
        </View>

        {/* Simulated Camera Viewfinder */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.cameraBox}>
            {/* Scanning Laser Line */}
            <Animated.View
              style={[
                styles.scanLaser,
                {
                  transform: [{ translateY: scannerAnim }],
                  backgroundColor: activeTheme.colors.primary,
                },
              ]}
            />
            
            {/* Viewfinder Corners */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            <Ionicons name="qr-code" size={100} color="rgba(15, 76, 58, 0.15)" />
          </View>
        </View>

        {/* Scan Actions */}
        <View style={styles.scanActionsContainer}>
          <TouchableOpacity
            style={[styles.simScanButton, { backgroundColor: activeTheme.colors.primary }]}
            onPress={() => handleSimulateScan()}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.simScanText}>Imbas Kod QR CP Aktif</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualCodeButton}
            onPress={() => setScanModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.manualCodeButtonText, { color: activeTheme.colors.primary }]}>
              Masukkan Kod Laluan Manual
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Tab 4: Team Profile & Leaderboard Content
  const renderProfileTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Team Card */}
        <Card role="participant" borderAccent="left" title="Profil Kumpulan">
          <View style={styles.profileHeader}>
            <View style={[styles.profileAvatar, { backgroundColor: activeTheme.colors.primaryLight }]}>
              <Text style={[styles.profileAvatarText, { color: activeTheme.colors.primary }]}>PH</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={[styles.profileTeamName, { color: activeTheme.colors.text }]}>
                {user?.name === 'Syamil' ? 'Pasukan Harimau' : 'Wira Titiwangsa'}
              </Text>
              <Text style={[styles.profileSubText, { color: activeTheme.colors.textMuted }]}>
                Ketua Kumpulan: {user?.name || 'Syamil'}
              </Text>
              <Text style={[styles.profileSubText, { color: activeTheme.colors.textMuted }]}>
                Ahli Kumpulan: 4 Orang
              </Text>
            </View>
          </View>
        </Card>

        {/* Leaderboard Card */}
        <Card role="participant" title="Kedudukan Semasa Kumpulan">
          {teams.length === 0 ? (
            <Text style={{ fontSize: 13, color: activeTheme.colors.textMuted, fontStyle: 'italic', paddingVertical: 8 }}>
              Tiada data kedudukan kumpulan lagi.
            </Text>
          ) : (
            teams.map((team: any, idx: number) => {
              const isUserTeam = team.name === ((user as any)?.teamName || 'Pasukan Harimau');
              return (
                <View
                  key={team.id || idx}
                  style={[
                    styles.leaderboardRow,
                    { borderBottomColor: activeTheme.colors.border },
                    isUserTeam && {
                      backgroundColor: activeTheme.colors.primaryLight,
                      borderRadius: activeTheme.radius.sm,
                      paddingHorizontal: 8,
                    },
                  ]}
                >
                  <View style={styles.leaderboardLeft}>
                    <Text
                      style={[
                        styles.rankText,
                        { color: isUserTeam ? activeTheme.colors.primary : activeTheme.colors.text },
                        idx === 0 && { color: '#EAB308', fontWeight: 'bold' },
                      ]}
                    >
                      #{idx + 1}
                    </Text>
                    <Text
                      style={[
                        styles.teamNameText,
                        { color: isUserTeam ? activeTheme.colors.primary : activeTheme.colors.text },
                        isUserTeam && { fontWeight: 'bold' },
                      ]}
                    >
                      {team.name}
                    </Text>
                  </View>

                  <View style={styles.leaderboardRight}>
                    {rules.pointsSystemEnabled && (
                      <Text style={[styles.pointsText, { color: activeTheme.colors.text }]}>
                        {team.totalPoints || 0} Pts
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: COLORS.danger, borderWidth: 1 }]}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutBtnText}>Log Keluar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.colors.background }]}>
      
      {/* Event Header Panel */}
      <View style={[styles.headerPanel, { backgroundColor: activeTheme.colors.card, borderBottomColor: activeTheme.colors.border }]}>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerEventName, { color: activeTheme.colors.text }]} numberOfLines={1}>
            {activeEvent?.name || 'XploreQuest Event'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={[styles.headerTeamName, { color: activeTheme.colors.primary, marginTop: 0 }]}>
              🏆 {(user as any)?.teamName || user?.name || 'Kumpulan Peserta'}
            </Text>
            <OfflineStatusChip />
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerInfoBtn}
          onPress={() =>
            Alert.alert(
              'Informasi Acara',
              `${activeEvent?.name || 'XploreQuest'}\nTarikh: ${activeEvent?.date || '-'}\nLokasi: ${
                activeEvent?.locationName || '-'
              }`
            )
          }
        >
          <Ionicons name="information-circle-outline" size={24} color={activeTheme.colors.textMuted} />
        </TouchableOpacity>
      </View>


      {/* Main Tab Render Switch */}
      <View style={styles.mainContent}>
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'map' && renderMapTab()}
        {activeTab === 'scan' && renderScanTab()}
        {activeTab === 'profile' && renderProfileTab()}
      </View>

      {/* Manual Code Modal */}
      <Modal
        visible={scanModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setScanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderRadius: activeTheme.radius.md }]}>
            <View style={styles.modalManual}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: activeTheme.colors.text }]}>Kod Laluan Manual</Text>
                <TouchableOpacity onPress={() => setScanModalVisible(false)}>
                  <Ionicons name="close" size={24} color={activeTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubText}>
                Masukkan kod manual 6-aksara yang diberikan oleh Marshal di pos kawalan aktif.
              </Text>
              
              {__DEV__ && currentCpId && (
                <Text style={styles.demoHintText}>
                  💡 Kod Ujian Dev: Kod laluan untuk checkpoint aktif ialah{' '}
                  <Text style={{ fontWeight: 'bold' }}>{`PASS${currentCpId.replace('-', '')}`}</Text>
                </Text>
              )}

              <TextInput
                style={[styles.manualInput, { borderColor: activeTheme.colors.border, borderRadius: activeTheme.radius.sm }]}
                placeholder="Contoh: PASSCP003"
                placeholderTextColor="#94A3B8"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: activeTheme.colors.primary, borderRadius: activeTheme.radius.sm }]}
                onPress={handleManualCodeSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSubmitText}>Sahkan Kod</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Shortcut Quick Action Button (FAB) - only shows on Dashboard tab */}
      {activeTab === 'dashboard' && currentCpId && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: activeTheme.colors.accent, ...activeTheme.shadows.md }]}
          onPress={() => handleSimulateScan()}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Custom Bottom Tab Bar navigation */}
      <View style={[styles.tabBar, { borderTopColor: activeTheme.colors.border, backgroundColor: activeTheme.colors.card }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'}
            size={22}
            color={activeTab === 'dashboard' ? activeTheme.colors.primary : activeTheme.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'dashboard' ? activeTheme.colors.primary : activeTheme.colors.textMuted,
                fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
              },
            ]}
          >
            Utama
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('map');
            // Reset scan line animation if open
            scannerAnim.setValue(0);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'map' ? 'map' : 'map-outline'}
            size={22}
            color={activeTab === 'map' ? activeTheme.colors.primary : activeTheme.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'map' ? activeTheme.colors.primary : activeTheme.colors.textMuted,
                fontWeight: activeTab === 'map' ? 'bold' : 'normal',
              },
            ]}
          >
            Peta
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            handleSimulateScan();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.scanIconCenter, { backgroundColor: activeTheme.colors.primary }]}>
            <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
          </View>
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'scan' ? activeTheme.colors.primary : activeTheme.colors.textMuted,
                fontWeight: activeTab === 'scan' ? 'bold' : 'normal',
                marginTop: 2,
              },
            ]}
          >
            Imbas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'profile' ? 'people' : 'people-outline'}
            size={22}
            color={activeTab === 'profile' ? activeTheme.colors.primary : activeTheme.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'profile' ? activeTheme.colors.primary : activeTheme.colors.textMuted,
                fontWeight: activeTab === 'profile' ? 'bold' : 'normal',
              },
            ]}
          >
            Kumpulan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Checkpoint Detail Screen Modal */}
      <CheckpointDetailScreen
        visible={detailModalVisible}
        checkpoint={selectedCpForDetail}
        status={selectedCpForDetail ? getCheckpointStatus(selectedCpForDetail.id) : 'locked'}
        index={selectedCpForDetail ? checkpoints.indexOf(selectedCpForDetail) : 0}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCpForDetail(null);
        }}
        onSkip={handleSkipCheckpoint}
        onScanQR={handleSimulateScan}
      />

      {/* Global Toast Notifications */}
      <ToastNotification
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />

      {/* QR Scan Simulator Modal */}
      <QRScanSimulationScreen
        visible={qrSimVisible}
        checkpoint={checkpoints.find((cp: Checkpoint) => cp.id === (cpIdBeingScanned || currentCpId)) || null}
        onClose={() => setQrSimVisible(false)}
        onScanSuccess={handleScanCompleted}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  headerPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerEventName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTeamName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  headerInfoBtn: {
    padding: 6,
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 80,
    gap: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
  },
  statBox: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'flex-start',
    gap: 4,
  },
  statIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeCpCard: {
    shadowColor: '#0A1810',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  activeCpName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  activeCpDetailItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  activeCpDetailLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activeCpDetailVal: {
    fontSize: 13,
    lineHeight: 18,
  },
  activeActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  skipBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scanBtnAction: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  scanBtnActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    marginTop: SPACING.sm,
    gap: 2,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  finishContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: 10,
  },
  finishTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  finishSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  scanIconCenter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  mapMockupContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  lakeBg: {
    position: 'absolute',
    top: '30%',
    left: '30%',
    width: '40%',
    height: '40%',
    borderRadius: 100,
    backgroundColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#60A5FA',
    borderWidth: 1.5,
  },
  lakeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#1E3A8A',
    opacity: 0.6,
  },
  mapMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  mapMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  markerText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  pulseCircle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.6,
  },
  mapInfoBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 76, 58, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  scannerTabContainer: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  scannerHeader: {
    alignItems: 'center',
    marginTop: 20,
    gap: 4,
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  scannerSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBox: {
    width: 240,
    height: 240,
    borderColor: 'rgba(15, 76, 58, 0.3)',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  scanLaser: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    opacity: 0.8,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.participant.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: RADIUS.xs,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: RADIUS.xs,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: RADIUS.xs,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: RADIUS.xs,
  },
  scanActionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 80,
  },
  simScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    gap: 8,
  },
  simScanText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  manualCodeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  manualCodeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileTeamName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileSubText: {
    fontSize: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '600',
    width: 24,
  },
  teamNameText: {
    fontSize: 13,
  },
  leaderboardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    width: 48,
    textAlign: 'right',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    gap: 8,
    marginTop: SPACING.md,
  },
  logoutBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalManual: {
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  demoHintText: {
    fontSize: 11,
    color: COLORS.pending,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: RADIUS.xs,
    lineHeight: 15,
  },
  manualInput: {
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  modalSubmitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pendingCard: {
    marginBottom: 16,
  },
  pendingDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  pendingItemRow: {
    // base styles (overridden/extended in component)
  },
  viewDetailBtn: {
    // base styles (overridden/extended in component)
  },
});
