import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';


import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, Badge, PrimaryButton, SecondaryButton, OfflineStatusChip, SkeletonLoader, EmptyState, DynamicQRDisplay, CustomModalDialog } from '../components';



import { mockCheckpoints, mockTeams, Team } from '../mockData';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

type TabType = 'queue' | 'completed';

export default function CrewDashboardScreen() {
  const { user, logout, teams, setTeams, isRaceStarted, startRace } = useApp();

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();
  const completedTeamId = route.params?.completedTeamId;

  // Find current checkpoint assigned to this crew member
  const checkpoint = mockCheckpoints.find(cp => cp.id === user?.checkpointId) || mockCheckpoints[1];

  const [loading, setLoading] = useState(true);

  // Distribute mock teams across two states for local demo
  const [queueTeams, setQueueTeams] = useState<Team[]>(
    mockTeams.filter((_, idx) => idx % 2 === 0)
  );
  const [completedTeams, setCompletedTeams] = useState<Team[]>(
    mockTeams.filter((_, idx) => idx % 2 === 1)
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>('queue');

  // Start Point Crew Specific States
  const [startActiveTab, setStartActiveTab] = useState<'register' | 'released'>('register');
  const [selectedTeamForRelease, setSelectedTeamForRelease] = useState<Team | null>(null);
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const startRegisterTeams = teams.filter(t => t.status === 'pending');
  const startReleasedTeams = teams.filter(t => t.status === 'approved');

  // End Point (TAMAT) Specific States
  const [endQrValue, setEndQrValue] = useState('');
  const [endQrGenerated, setEndQrGenerated] = useState(false);
  const [endQrKey, setEndQrKey] = useState(0);

  // Custom Modal Dialog state
  const [startRaceModalVisible, setStartRaceModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const handleGenerateEndQR = () => {
    const token = `END-${checkpoint.id}-${Date.now().toString().slice(-8)}`;
    setEndQrValue(token);
    setEndQrGenerated(true);
    setEndQrKey(prev => prev + 1);
  };



  const handleConfirmStartRace = () => {
    setStartRaceModalVisible(true);
  };

  // Handle routing parameters when completing verification wizard
  useEffect(() => {
    if (completedTeamId) {
      const teamInQueue = queueTeams.find(t => t.id === completedTeamId);

      if (teamInQueue) {
        setQueueTeams(prev => prev.filter(t => t.id !== completedTeamId));
        setCompletedTeams(prev => [teamInQueue, ...prev]);
        setActiveTab('completed');
      }

      // Reset routing param to prevent rerun
      navigation.setParams({ completedTeamId: undefined } as any);
    }
  }, [completedTeamId]);


  const handleLogout = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'RoleSelect' }],
    });
  };

  const handleSelectCheckpoint = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CrewSelectCheckpoint' }],
    });
  };

  const handleTeamReleaseSelect = (team: Team) => {
    setExpandedTeamId(prev => (prev === team.id ? null : team.id));
  };

  const handleGenerateReleaseQR = (team: Team) => {
    setSelectedTeamForRelease(team);
    setReleaseModalVisible(true);
  };

  const handleConfirmRelease = () => {
    if (!selectedTeamForRelease) return;
    setIsReleasing(true);
    setTimeout(() => {
      setIsReleasing(false);
      setReleaseModalVisible(false);
      
      // Update team status in AppContext
      setTeams(prev =>
        prev.map(t =>
          t.id === selectedTeamForRelease.id ? { ...t, status: 'approved' } : t
        )
      );


      Alert.alert(
        'Pelepasan Berjaya',
        `Pasukan "${selectedTeamForRelease.name}" telah berjaya didaftarkan kehadiran dan dilepaskan mula!`
      );
      setSelectedTeamForRelease(null);
    }, 1500);
  };

  const renderStartPointDashboard = () => {
    const activeStartList = startActiveTab === 'register' ? startRegisterTeams : startReleasedTeams;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

        {/* Start Point Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleSelectCheckpoint}>
              <Ionicons name="location-outline" size={16} color={COLORS.crew.primary} />
              <Text style={styles.backButtonText}>Tukar Pos</Text>
            </TouchableOpacity>

            <OfflineStatusChip />

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              <Text style={styles.logoutButtonText}>Log Keluar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.checkpointBanner}>
            <View style={[styles.checkpointIconContainer, { backgroundColor: COLORS.success }]}>
              <Text style={[styles.checkpointIconText, { color: '#FFFFFF', fontSize: 10 }]}>MULA</Text>
            </View>
            <View style={styles.checkpointTitleContainer}>
              <Text style={styles.marshalLabel}>Urus Setia Pendaftaran:</Text>
              <Text style={styles.checkpointName} numberOfLines={1}>
                {checkpoint.name}
              </Text>
            </View>
          </View>

          {/* Master Start Race Button / Active Banner */}
          <View style={{ marginTop: SPACING.sm }}>
            {isRaceStarted ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: RADIUS.md,
                borderWidth: 1.5,
                borderColor: COLORS.success,
                gap: 8,
              }}>
                <Ionicons name="radio-outline" size={18} color={COLORS.success} />
                <Text style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.success, letterSpacing: 0.5 }}>
                  PERLUMBAAN SEDANG BERLANGSUNG
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleConfirmStartRace}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.danger,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: RADIUS.md,
                  gap: 8,
                  ...SHADOWS.md,
                }}
              >
                <Ionicons name="play-circle" size={22} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#FFFFFF', letterSpacing: 0.8 }}>
                  MULAKAN PERLUMBAAN (START RACE)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Field Journal Custom Confirm Modal Dialog */}
        <CustomModalDialog
          visible={startRaceModalVisible}
          variant="danger"
          icon="play-circle-outline"
          title="Mula Perlumbaan Rasmi? 🏁"
          message="Tindakan ini akan memulakan jam perlumbaan rasmi dan menyiarkan status perlumbaan aktif kepada semua peserta & krew."
          buttons={[
            {
              text: 'BATAL',
              style: 'cancel',
            },
            {
              text: 'MULAKAN PERLUMBAAN',
              style: 'destructive',
              onPress: () => {
                startRace();
                setTimeout(() => setSuccessModalVisible(true), 300);
              },
            },
          ]}
          onDismiss={() => setStartRaceModalVisible(false)}
        />

        {/* Success Modal Dialog */}
        <CustomModalDialog
          visible={successModalVisible}
          variant="success"
          icon="checkmark-circle-outline"
          title="PERLUMBAAN BERMULA! 🎉"
          message="Semua krew dan peserta telah dimaklumkan secara langsung."
          buttons={[{ text: 'TERUSKAN', style: 'default' }]}
          onDismiss={() => setSuccessModalVisible(false)}
        />


        {/* Start Point Tab Switcher */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[styles.tabButton, startActiveTab === 'register' && styles.activeTabButton]}
            onPress={() => setStartActiveTab('register')}
          >
            <Text style={[styles.tabText, startActiveTab === 'register' && styles.activeTabText]}>
              Pendaftaran Kehadiran
            </Text>
            <View
              style={[
                styles.tabBadge,
                startActiveTab === 'register' ? styles.activeTabBadge : styles.inactiveTabBadge,
              ]}
            >
              <Text style={[styles.tabBadgeText, startActiveTab === 'register' && styles.activeTabBadgeText]}>
                {startRegisterTeams.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, startActiveTab === 'released' && styles.activeTabButton]}
            onPress={() => setStartActiveTab('released')}
          >
            <Text style={[styles.tabText, startActiveTab === 'released' && styles.activeTabText]}>
              Telah Dilepaskan
            </Text>
            <View
              style={[
                styles.tabBadge,
                startActiveTab === 'released' ? styles.activeTabBadge : styles.inactiveTabBadge,
              ]}
            >
              <Text style={[styles.tabBadgeText, startActiveTab === 'released' && styles.activeTabBadgeText]}>
                {startReleasedTeams.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Start Point List Content */}
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {activeStartList.length === 0 ? (
            <EmptyState
              title="Tiada Kumpulan"
              description={
                startActiveTab === 'register'
                  ? 'Tiada pasukan pre-pendaftaran tertunda untuk didaftarkan.'
                  : 'Belum ada pasukan yang dilepaskan hari ini.'
              }
              icon={startActiveTab === 'released' ? 'checkmark-done-circle-outline' : 'people-outline'}
            />
          ) : (
            activeStartList.map((team) => {
              const isExpanded = expandedTeamId === team.id;
              return (
                <View key={team.id} style={{ marginBottom: SPACING.md }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleTeamReleaseSelect(team)}
                  >
                    <Card role="crew" borderAccent="left" style={styles.teamCard}>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.teamInfoContainer}>
                          <Text style={styles.teamNameText}>{team.name}</Text>
                          <Text style={styles.teamIdText}>ID: {team.id}</Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={COLORS.textMuted}
                        />
                      </View>

                      {isExpanded && (
                        <View style={{ marginTop: SPACING.md }}>
                          <View style={styles.cardDivider} />
                          
                          {/* Registered User info from Pre-Event Form */}
                          <View style={{ gap: SPACING.xs, marginVertical: SPACING.sm }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 }}>
                              Maklumat Pendaftaran Google Form (XploreQuest Form):
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Ketua Kumpulan:</Text>
                              <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>{team.leaderName || 'N/A'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>No. Telefon:</Text>
                              <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>{team.phone || 'N/A'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Senarai Ahli:</Text>
                              <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text, flex: 1, textAlign: 'right', marginLeft: 16 }}>
                                {team.membersList || 'N/A'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.cardDivider} />

                          {startActiveTab === 'register' ? (
                            <PrimaryButton
                              label="Sahkan & Jana QR Pelepasan"
                              onPress={() => handleGenerateReleaseQR(team)}
                              role="crew"
                              icon={<Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />}
                              style={{ marginTop: SPACING.sm }}
                            />
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 8 }}>
                              <Ionicons name="checkmark-done-circle" size={18} color={COLORS.success} />
                              <Text style={{ color: COLORS.success, fontWeight: 'bold', fontSize: 13 }}>
                                Telah Dilepaskan Mula
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </Card>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* QR Code Release Modal */}
        <Modal
          visible={releaseModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setReleaseModalVisible(false)}
        >
          <View style={styles.startModalOverlay}>
            <View style={styles.startModalCard}>
              <View style={styles.startModalHeaderRow}>
                <Text style={styles.startModalTitle}>Kod QR Pelepasan Mula</Text>
                <TouchableOpacity onPress={() => setReleaseModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.startModalSubText}>
                Minta peserta Pasukan "{selectedTeamForRelease?.name}" untuk mengimbas kod QR ini di skrin "Sertai Acara" peranti mereka.
              </Text>

              {/* Simulated QR Code Wrapper */}
              <View style={styles.qrCodeWrapper}>
                {isReleasing ? (
                  <View style={{ alignItems: 'center', gap: 12 }}>
                    <ActivityIndicator size="large" color={COLORS.crew.primary} />
                    <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Mengesahkan pelepasan mula...</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 16 }}>
                    <Ionicons name="qr-code" size={180} color={COLORS.text} />
                    <Badge label={`START-RELEASE-${selectedTeamForRelease?.id}`} state="info" />
                  </View>
                )}
              </View>

              {!isReleasing && (
                <PrimaryButton
                  label="Simulasi Scan Berjaya (Selesai)"
                  onPress={handleConfirmRelease}
                  role="crew"
                  style={{ width: '100%', marginTop: SPACING.md }}
                />
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  };

  const handleTeamTap = (team: Team) => {
    navigation.navigate('CrewVerificationWizard', { teamId: team.id });
  };

  const renderTeamCard = (team: Team) => {
    return (
      <TouchableOpacity
        key={team.id}
        activeOpacity={0.8}
        onPress={() => handleTeamTap(team)}
        disabled={activeTab === 'completed'}
      >

        <Card role="crew" style={styles.teamCard} borderAccent="left">
          <View style={styles.cardHeaderRow}>
            <View style={styles.teamInfoContainer}>
              <Text style={styles.teamNameText}>{team.name}</Text>
              <Text style={styles.teamIdText}>ID: {team.id}</Text>
            </View>
            <View style={styles.rightHeaderContainer}>
              <View style={styles.memberBadge}>
                <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.memberCountText}>{team.memberCount} Ahli</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.cardFooterRow}>
            <View style={styles.statusInfo}>
              {activeTab === 'queue' && (
                <View style={styles.statusRow}>
                  <View style={[styles.dotIndicator, { backgroundColor: COLORS.pending }]} />
                  <Text style={styles.statusLabelText}>Sedang Beratur</Text>
                </View>
              )}

              {activeTab === 'completed' && (
                <View style={styles.statusRow}>
                  <View style={[styles.dotIndicator, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.statusLabelText}>Selesai Hari Ini</Text>
                </View>
              )}
            </View>

            {activeTab !== 'completed' && (
              <View style={styles.actionPromptContainer}>
                <Text style={styles.actionPromptText}>Sahkan Tugas</Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.crew.primary}
                  style={styles.actionIcon}
                />
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const getActiveList = () => {
    switch (activeTab) {
      case 'queue':
        return queueTeams;
      case 'completed':
        return completedTeams;
      default:
        return [];
    }
  };


  const activeList = getActiveList();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <View style={styles.checkpointBanner}>
            <Text style={styles.checkpointName}>Memuatkan data...</Text>
          </View>
        </View>
        <View style={{ padding: SPACING.md }}>
          <SkeletonLoader type="list" />
        </View>
      </SafeAreaView>
    );
  }

  const renderFinishPointDashboard = () => {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

        {/* Finish Point Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleSelectCheckpoint}>
              <Ionicons name="location-outline" size={16} color={COLORS.crew.primary} />
              <Text style={styles.backButtonText}>Tukar Pos</Text>
            </TouchableOpacity>

            <OfflineStatusChip />

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              <Text style={styles.logoutButtonText}>Log Keluar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.checkpointBanner}>
            <View style={[styles.checkpointIconContainer, { backgroundColor: COLORS.crew.primary }]}>
              <Text style={[styles.checkpointIconText, { color: '#FFFFFF', fontSize: 10 }]}>TAMAT</Text>
            </View>
            <View style={styles.checkpointTitleContainer}>
              <Text style={styles.marshalLabel}>Stesen Garisan Penamat:</Text>
              <Text style={styles.checkpointName} numberOfLines={1}>
                {checkpoint.name}
              </Text>
            </View>
            {isRaceStarted && (
              <Badge label="RACE ACTIVE" state="success" />
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <Card role="crew" style={{ marginBottom: SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="flag-outline" size={24} color={COLORS.crew.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text }}>
                  Penyiaran Kod QR Penamat
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                  Mana-mana pasukan yang tiba di garisan penamat boleh mengimbas Kod QR ini secara terus.
                </Text>
              </View>
            </View>
          </Card>

          {/* QR Code Section */}
          <Card role="crew" style={{ alignItems: 'center', paddingVertical: SPACING.xl, marginBottom: SPACING.lg }}>
            {endQrGenerated ? (
              <View style={{ alignItems: 'center' }}>
                <DynamicQRDisplay
                  key={endQrKey}
                  value={endQrValue}
                  duration={30}
                  size={200}
                  onExpire={handleGenerateEndQR}
                  onRefresh={handleGenerateEndQR}
                />
                <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'center' }}>
                  ⚡ Kod QR diperbaharui secara automatik setiap 30 saat untuk keselamatan.
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: SPACING.lg }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: COLORS.crew.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: SPACING.md
                }}>
                  <Ionicons name="qr-code-outline" size={40} color={COLORS.crew.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: 4 }}>
                  Kod QR Belum Dijana
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.md }}>
                  Tekan butang di bawah untuk memulakan penyiaran Kod QR Garisan Penamat.
                </Text>
              </View>
            )}
          </Card>

          {/* Primary Action Button */}
          <PrimaryButton
            label={endQrGenerated ? 'Kemaskini Kod QR Penamat' : 'Jana Kod QR Penamat'}
            onPress={handleGenerateEndQR}
            role="crew"
            icon={<Ionicons name="refresh-outline" size={18} color="#FFFFFF" />}
            style={{ marginBottom: SPACING.lg }}
          />

          {/* Finished Teams Summary */}
          <Card role="crew" style={{ padding: SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pasukan Selesai Hari Ini
              </Text>
              <Badge label={`${completedTeams.length} Pasukan`} state="success" />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {completedTeams.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted, italic: true } as any}>
                  Belum ada pasukan yang tamat imbasan.
                </Text>
              ) : (
                completedTeams.map(t => (
                  <View key={t.id} style={{
                    backgroundColor: COLORS.crew.primaryLight,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: RADIUS.full,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderStyle: 'dashed'
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semiBold, color: COLORS.crew.primary }}>
                      ✓ {t.name}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  };

  if (checkpoint.isStart) {
    return renderStartPointDashboard();
  }

  if (checkpoint.isFinish) {
    return renderFinishPointDashboard();
  }

  return (


    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Marshal Checkpoint Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleSelectCheckpoint}>
            <Ionicons name="location-outline" size={16} color={COLORS.crew.primary} />
            <Text style={styles.backButtonText}>Tukar Pos</Text>
          </TouchableOpacity>

          <OfflineStatusChip />

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
            <Text style={styles.logoutButtonText}>Log Keluar</Text>
          </TouchableOpacity>
        </View>


        <View style={styles.checkpointBanner}>
          <View style={styles.checkpointIconContainer}>
            <Text style={styles.checkpointIconText}>
              {checkpoint.id.replace('CP-', '0')}
            </Text>
          </View>
          <View style={styles.checkpointTitleContainer}>
            <Text style={styles.marshalLabel}>Marshal bertugas di:</Text>
            <Text style={styles.checkpointName} numberOfLines={1}>
              {checkpoint.name}
            </Text>
          </View>
        </View>
      </View>

      {/* Custom Segments / Tab Bar */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'queue' && styles.activeTabButton]}
          onPress={() => setActiveTab('queue')}
        >
          <Text style={[styles.tabText, activeTab === 'queue' && styles.activeTabText]}>
            Beratur
          </Text>
          <View
            style={[
              styles.tabBadge,
              activeTab === 'queue' ? styles.activeTabBadge : styles.inactiveTabBadge,
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                activeTab === 'queue' && styles.activeTabBadgeText,
              ]}
            >
              {queueTeams.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'completed' && styles.activeTabButton]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Selesai
          </Text>
          <View
            style={[
              styles.tabBadge,
              activeTab === 'completed' ? styles.activeTabBadge : styles.inactiveTabBadge,
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                activeTab === 'completed' && styles.activeTabBadgeText,
              ]}
            >
              {completedTeams.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tab Content List */}
      <ScrollView
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeList.length === 0 ? (
          <EmptyState
            title="Tiada Kumpulan"
            description={
              activeTab === 'queue'
                ? 'Tiada pasukan yang sedang beratur di pos kawalan ini.'
                : 'Belum ada pasukan yang menamatkan tugasan hari ini.'
            }
            icon={activeTab === 'completed' ? 'checkmark-done-circle-outline' : 'people-outline'}
          />
        ) : (


          activeList.map(team => renderTeamCard(team))
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
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.crew.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  backButtonText: {
    color: COLORS.crew.primary,
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    gap: 4,
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  checkpointBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  checkpointIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.crew.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkpointIconText: {
    color: COLORS.textLight,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 18,
  },
  checkpointTitleContainer: {
    flex: 1,
  },
  marshalLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  checkpointName: {
    fontSize: TYPOGRAPHY.fontSize.h3,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTabButton: {
    borderBottomColor: COLORS.crew.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.crew.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabBadge: {
    backgroundColor: COLORS.crew.primaryLight,
  },
  inactiveTabBadge: {
    backgroundColor: '#F1F3F2',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
  },
  activeTabBadgeText: {
    color: COLORS.crew.primary,
  },
  listContainer: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  teamCard: {
    padding: SPACING.md,
    marginBottom: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  teamInfoContainer: {
    flex: 1,
  },
  teamNameText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  teamIdText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rightHeaderContainer: {
    alignItems: 'flex-end',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
    gap: 4,
  },
  memberCountText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  cardDividerColor: {
    backgroundColor: COLORS.border,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabelText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  actionPromptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionPromptText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.crew.primary,
  },
  actionIcon: {
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    opacity: 0.7,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitleText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySubtitleText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  modalBody: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  modalTeamLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 1,
  },
  modalTeamName: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.crew.primary,
  },
  modalTeamId: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  checkpointSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.crew.primaryLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  checkpointSummaryTextContainer: {
    flex: 1,
  },
  checkpointSummaryLabel: {
    fontSize: 9,
    color: COLORS.crew.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.5,
  },
  checkpointSummaryValue: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.crew.primaryDark,
  },
  modalExplainerText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalConfirmButton: {
    flex: 1,
  },
  qrCodeWrapper: {
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.lg,
    ...SHADOWS.sm,
  },
  startModalCard: {
    width: '90%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  startModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startModalTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  startModalSubText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  startModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});


