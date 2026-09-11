/**
 * ============================================================================
 * NOTE FOR FUTURE DEVELOPERS:
 * This component (DemoMenu.tsx) is a presentation/storytelling aid designed 
 * specifically for client walkthroughs. It allows organizers and presenters to 
 * seamlessly jump between roles and mock screen states.
 * 
 * Please REMOVE this component and its root reference in App.tsx before compiling 
 * any production or staging builds for deployment.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useApp } from '../AppContext';
import { RootStackParamList } from '../App';
import { mockEvent, mockCheckpoints } from '../mockData';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

const { height } = Dimensions.get('window');

// Global navigation reference for decoupling jump commands
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const DemoMenu = () => {
  const {
    login,
    logout,
    setActiveEvent,
    setCheckpoints,
    setRules,
    setIsOffline,
    setSyncQueueCount,
    resetDemoState,
  } = useApp();

  const [menuVisible, setMenuVisible] = useState(false);

  const navigateTo = (screenName: keyof RootStackParamList, params?: any) => {
    if (navigationRef.isReady()) {
      setMenuVisible(false);
      navigationRef.navigate(screenName as any, params);
    } else {
      Alert.alert('Ralat', 'Navigasi belum sedia.');
    }
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Data Demo',
      'Adakah anda pasti mahu merest semula semua data, penetapan denda, perimeter geofence, dan log status ke tetapan asal?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset Semula',
          style: 'destructive',
          onPress: () => {
            // Reset context states
            resetDemoState();
            setActiveEvent(mockEvent);
            setCheckpoints(mockCheckpoints);
            setRules({
              maxRaceTime: 240,
              taskTimeLimit: 15,
              latePenaltyMin: 10,
              pointPenaltyPts: 50,
              bonusPoints: 100,
              pointsSystemEnabled: true,
              latePenaltyEnabled: true,
              taskTimeLimitEnabled: true,
              pointPenaltyEnabled: true,
              bonusPointsEnabled: true,
            });
            setIsOffline(false);
            setSyncQueueCount(0);
            logout();

            setMenuVisible(false);

            // Redirect back to Role Select splash
            if (navigationRef.isReady()) {
              navigationRef.reset({
                index: 0,
                routes: [{ name: 'RoleSelect' }],
              });
            }
            Alert.alert('Berjaya', 'Semua data dan peranti telah di-reset semula.');
          },
        },
      ]
    );
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <TouchableOpacity
        style={styles.triggerButton}
        activeOpacity={0.85}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="build" size={20} color="#FFFFFF" />
        <Text style={styles.triggerText}>Demo Menu</Text>
      </TouchableOpacity>

      {/* Navigation & Jump Modal */}
      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="construct" size={20} color={COLORS.admin.primary} />
                <Text style={styles.modalTitle}>Menu Pembentangan Demo</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
              
              {/* Shortcut Section: Quick Jumps */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pintas Peranan & Skrin Utama</Text>
                
                <View style={styles.gridRow}>
                  <TouchableOpacity
                    style={[styles.gridBtn, { backgroundColor: COLORS.participant.primaryLight }]}
                    onPress={() => navigateTo('RoleSelect')}
                  >
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.participant.primary} />
                    <Text style={[styles.gridBtnText, { color: COLORS.participant.primary }]}>Pilih Peranan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.gridBtn, { backgroundColor: COLORS.admin.primaryLight }]}
                    onPress={() => navigateTo('Dashboard')}
                  >
                    <Ionicons name="home-outline" size={20} color={COLORS.admin.primary} />
                    <Text style={[styles.gridBtnText, { color: COLORS.admin.primary }]}>Dashboard</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Participant Story Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aliran 1: Urus Urus & Peserta (Participant)</Text>
                
                <View style={styles.gridRow}>
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('ParticipantJoin')}
                  >
                    <Ionicons name="enter-outline" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Penyertaan Kumpulan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('StaggeredStart')}
                  >
                    <Ionicons name="time-outline" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Pelepasan Mula</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Crew Story Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aliran 2: Marshal / Pos Kawalan (Crew)</Text>
                
                <View style={styles.gridRow}>
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('CrewVerificationWizard', { teamId: 'TEAM-001' })}
                  >
                    <Ionicons name="checkmark-done" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Verifikasi Kumpulan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('AntiCheatExplainer')}
                  >
                    <Ionicons name="shield-checkmark" size={18} color={COLORS.success} />
                    <Text style={[styles.gridBtnText, { color: COLORS.success }]}>Penjelasan Keselamatan</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Admin Story Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aliran 3: Pengurusan Acara (Admin)</Text>
                
                <View style={styles.gridRow}>
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('AdminCreateEvent')}
                  >
                    <Ionicons name="add-circle" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Cipta Acara</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('AdminGeofenceDesigner')}
                  >
                    <Ionicons name="map" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Geofence Designer</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.gridRow}>
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('AdminCheckpointManager')}
                  >
                    <Ionicons name="flag" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Urus Pos Kawalan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('AdminRulesConfig')}
                  >
                    <Ionicons name="options" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Parameter Denda</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.gridRow}>
                  <TouchableOpacity
                    style={styles.gridBtn}
                    onPress={() => navigateTo('AdminLeaderboard')}
                  >
                    <Ionicons name="podium" size={18} color={COLORS.text} />
                    <Text style={styles.gridBtnText}>Papan Live Leaderboard</Text>
                  </TouchableOpacity>

                  <View style={styles.gridPlaceholder} />
                </View>
              </View>

              {/* Special State controls */}
              <View style={[styles.section, styles.resetSection]}>
                <Text style={styles.sectionTitle}>Operasi Keadaan & Reset</Text>
                <TouchableOpacity
                  style={styles.resetBtn}
                  activeOpacity={0.8}
                  onPress={handleResetData}
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.resetBtnText}>Reset Semua Data Demo</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: COLORS.admin.accent,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.md,
    zIndex: 9999,
  },
  triggerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
    padding: SPACING.md,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContainer: {
    gap: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  gridBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },

  gridPlaceholder: {
    flex: 1,
  },
  gridBtnText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    flex: 1,
  },
  resetSection: {
    borderColor: 'rgba(239, 68, 68, 0.15)',
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    gap: 8,
    ...SHADOWS.sm,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
