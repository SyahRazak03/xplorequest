import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, PrimaryButton, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

interface OtherTeamMock {
  name: string;
  checkpointNumber: number;
  checkpointName: string;
  icon: string;
}

export default function StaggeredStartScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isRaceStarted, startRace } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState(10);

  // 10-second auto-start countdown timer for mock demo
  useEffect(() => {
    if (isRaceStarted) {
      setShowWaitingModal(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
      return;
    }

    const timer = setInterval(() => {
      setAutoStartCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRaceStarted]);

  // Trigger startRace cleanly when countdown reaches 0
  useEffect(() => {
    if (autoStartCountdown === 0 && !isRaceStarted) {
      startRace();
    }
  }, [autoStartCountdown, isRaceStarted]);

  const otherTeams: OtherTeamMock[] = [
    {
      name: 'Rimba Rangers',
      checkpointNumber: 4,
      checkpointName: 'Dataran Kereta Kuda',
      icon: 'leaf-outline',
    },
    {
      name: 'Helang Gunung',
      checkpointNumber: 5,
      checkpointName: 'Pusat Rekreasi Air (Kayak)',
      icon: 'water-outline',
    },
    {
      name: 'Kancil Pintar',
      checkpointNumber: 6,
      checkpointName: 'Taman Canopy Walk',
      icon: 'walk-outline',
    },
    {
      name: 'Team Garuda Malaysia',
      checkpointNumber: 2,
      checkpointName: 'Jambatan Gantung Titiwangsa',
      icon: 'git-commit-outline',
    },
  ];

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleStart = () => {
    if (!isRaceStarted) {
      setShowWaitingModal(true);
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  const listHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280], // Approximate height for the 4 rows
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Branding */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>Cabaran Tasik Titiwangsa</Text>
          <Text style={styles.headerTitle}>Pelepasan Kumpulan</Text>
          <View style={styles.divider} />
        </View>

        {/* Assigned Start Point Card */}
        <Card style={styles.checkpointCard} role="participant">
          <View style={styles.badgeWrapper}>
            <Badge label="LOKASI PERMULAAN ANDA" state="success" />
          </View>

          {/* Visual Illustrative Icon */}
          <View style={styles.visualContainer}>
            <View style={styles.outerCircle}>
              <View style={styles.innerCircle}>
                <Image
                  source={require('../assets/XploreQuest_Icon.png')}
                  style={{ width: 56, height: 56 }}
                  resizeMode="contain"
                />
              </View>
            </View>
            {/* Ping animation effect */}
            <View style={[styles.pingCircle, styles.ping1]} />
            <View style={[styles.pingCircle, styles.ping2]} />
          </View>

          {/* Checkpoint Name */}
          <View style={styles.checkpointDetails}>
            <Text style={styles.checkpointLabel}>Checkpoint Anda</Text>
            <Text style={styles.checkpointTitle}>Checkpoint 3</Text>
            <Text style={styles.checkpointName}>Dataran Kereta Kuda</Text>

          </View>

          {/* Explanation Banner */}
          <View style={styles.explainerBanner}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.participant.primary} style={styles.explainerIcon} />
            <Text style={styles.explainerText}>
              Untuk mengelakkan kesesakan di laluan, kumpulan akan memulakan perlumbaan dari checkpoint yang berbeza!
            </Text>
          </View>
        </Card>

        {/* Expandable Accordion: Other Teams */}
        <Card style={styles.accordionCard} role="participant">
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={toggleExpand}
            activeOpacity={0.7}
          >
            <View style={styles.accordionTitleContainer}>
              <Ionicons name="people-outline" size={20} color={COLORS.text} style={styles.accordionTitleIcon} />
              <Text style={styles.accordionTitle}>Mula Pasukan Lain</Text>
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <Animated.View style={[styles.accordionContent, { maxHeight: listHeight, opacity: animation }]}>
            <View style={styles.listContainer}>
              {otherTeams.map((team, idx) => (
                <View key={idx} style={[styles.teamRow, idx === otherTeams.length - 1 && styles.lastRow]}>
                  <View style={styles.teamInfo}>
                    <View style={styles.teamIconWrapper}>
                      <Ionicons name={team.icon as any} size={18} color={COLORS.textMuted} />
                    </View>
                    <Text style={styles.teamName}>{team.name}</Text>
                  </View>
                  <View style={styles.teamCheckpoint}>
                    <Text style={styles.teamCheckpointText}>CP {team.checkpointNumber}</Text>
                    <Text style={styles.teamCheckpointSubtext} numberOfLines={1}>
                      {team.checkpointName}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        </Card>

        {/* Action Button & Auto Start Demo Countdown */}
        <View style={styles.actionContainer}>
          {/* Live 10s Demo Auto Start Indicator */}
          {!isRaceStarted && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(91, 58, 158, 0.1)',
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: RADIUS.full,
              marginBottom: SPACING.md,
              gap: 6,
              borderWidth: 1,
              borderColor: COLORS.participant.primary,
              borderStyle: 'dashed'
            }}>
              <Ionicons name="timer-outline" size={14} color={COLORS.participant.primary} />
              <Text style={{ fontSize: 12, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.participant.primary }}>
                Pelepasan Auto Demo: {autoStartCountdown}s
              </Text>
            </View>
          )}

          <PrimaryButton
            label={isRaceStarted ? "Mulai Sekarang (Let's Go!)" : `Mulai Sekarang (${autoStartCountdown}s)`}
            onPress={handleStart}
            role="participant"
            icon={<Ionicons name={isRaceStarted ? "play-outline" : "time-outline"} size={18} color={COLORS.textLight} />}
            style={styles.startButton}
          />
          <Text style={styles.footerHint}>
            {isRaceStarted 
              ? 'Perlumbaan telah bermula! Tekan untuk terus ke Dashboard.' 
              : `Perlumbaan akan dimulakan secara automatik dalam ${autoStartCountdown} saat (Demo).`}
          </Text>
        </View>
      </ScrollView>

      {/* Waiting for Crew Modal */}
      <Modal
        visible={showWaitingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWaitingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrapper}>
              <Ionicons name="time-outline" size={42} color={COLORS.participant.primary} />
            </View>

            <Text style={styles.modalTitle}>Perlumbaan Belum Bermula!</Text>
            
            <Text style={styles.modalSubtext}>
              Urus setia di Garisan Mula belum menekan butang <Text style={{ fontWeight: '700', color: COLORS.danger }}>MULAKAN PERLUMBAAN</Text>. 
            </Text>
            
            <View style={styles.pulseNotice}>
              <View style={styles.pulseDot} />
              <Text style={styles.pulseNoticeText}>
                Aplikasi akan memulakan perlumbaan dan melencong ke Dashboard secara automatik dalam {autoStartCountdown} saat.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowWaitingModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeModalBtnText}>Faham, Saya Tunggu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: SPACING.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.participant.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.participant.primary,
    borderRadius: RADIUS.xs,
    marginTop: SPACING.sm,
  },
  checkpointCard: {
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  badgeWrapper: {
    marginBottom: SPACING.md,
  },
  visualContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  outerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.participant.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...SHADOWS.sm,
  },
  innerCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.participant.primary,
  },
  pingCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.participant.primary,
    zIndex: 1,
  },
  ping1: {
    width: 120,
    height: 120,
    opacity: 0.15,
  },
  ping2: {
    width: 140,
    height: 140,
    opacity: 0.08,
  },
  checkpointDetails: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  checkpointLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  checkpointTitle: {
    fontSize: 26,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.participant.primary,
  },
  checkpointName: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  explainerBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.participant.primaryLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  explainerIcon: {
    marginRight: SPACING.sm,
  },
  explainerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.participant.primary,
    lineHeight: 18,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  accordionCard: {
    padding: 0,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  accordionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionTitleIcon: {
    marginRight: SPACING.sm,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  accordionContent: {
    overflow: 'hidden',
  },
  listContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.5,
  },
  teamIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.xs,
    backgroundColor: '#F1F3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  teamName: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.text,
  },
  teamCheckpoint: {
    alignItems: 'flex-end',
    flex: 0.5,
  },
  teamCheckpointText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.participant.primary,
  },
  teamCheckpointSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },
  actionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  startButton: {
    width: '100%',
  },
  footerHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FAF9F6',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    borderStyle: 'dashed',
    ...SHADOWS.md,
  },
  modalIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.admin.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  pulseNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.admin.primaryLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  pulseNoticeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    lineHeight: 15,
  },
  closeModalBtn: {
    backgroundColor: COLORS.admin.primary,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    width: '100%',
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
