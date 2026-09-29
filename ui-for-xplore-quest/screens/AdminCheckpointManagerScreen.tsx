import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Checkpoint } from '../types';
import { createCheckpoint, updateCheckpoint, deleteCheckpoint } from '../services/checkpointService';

import { Card, PrimaryButton, SecondaryButton, Badge, CheckpointFormModal, SkeletonLoader, EmptyState, CustomModalDialog } from '../components';

import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function AdminCheckpointManagerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { checkpoints, setCheckpoints, activeEvent, selectedEventId, user } = useApp();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const handleAddPress = () => {
    setSelectedCheckpoint(null);
    setModalVisible(true);
  };

  const handleEditPress = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
    setModalVisible(true);
  };

  const handleDeletePress = (id: string) => {
    setDeleteTargetId(id);
    setDeleteModalVisible(true);
  };

  const sortCheckpoints = (list: Checkpoint[]) => {
    const startCPs = list.filter(cp => cp.isStart);
    const finishCPs = list.filter(cp => cp.isFinish);
    const standardCPs = list.filter(cp => !cp.isStart && !cp.isFinish);
    return [...startCPs, ...standardCPs, ...finishCPs];
  };

  const normalizeCheckpoints = (list: Checkpoint[]) => {
    return sortCheckpoints(list);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 1) return;
    if (index === checkpoints.length - 1) return;
    const updated = [...checkpoints];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    
    setCheckpoints(normalizeCheckpoints(updated));
  };

  const handleMoveDown = (index: number) => {
    if (index === 0) return;
    if (index >= checkpoints.length - 2) return;
    const updated = [...checkpoints];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    
    setCheckpoints(normalizeCheckpoints(updated));
  };

  const handleSaveCheckpoint = async (data: Partial<Checkpoint>) => {
    const eventId = activeEvent?.id || selectedEventId || user?.eventId || '';
    if (!eventId) {
      Alert.alert('Error', 'Please select an active event first.');
      return;
    }
    const token = user?.idToken;

    if (selectedCheckpoint) {
      // Edit Mode
      let serverCheckpoint: Checkpoint | null = null;
      try {
        const res = await updateCheckpoint(
          eventId,
          selectedCheckpoint.id,
          {
            name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            clueText: data.clueText,
            taskDescription: data.taskDescription,
            scorePoints: data.scorePoints,
            isStart: data.isStart,
            isFinish: data.isFinish,
            isAttendanceStation: data.isAttendanceStation,
            isHiddenInMap: data.isHiddenInMap,
          },
          token
        );
        if (res && res.checkpoint) {
          serverCheckpoint = res.checkpoint;
        }
      } catch (err) {
        console.warn('Backend updateCheckpoint warning:', err);
      }

      setCheckpoints(prev => {
        let updated = prev.map(cp => {
          if (cp.id === selectedCheckpoint.id) {
            return { ...cp, ...(serverCheckpoint || data) } as Checkpoint;
          }
          // Enforce singular start/finish/attendance rules
          return {
            ...cp,
            isStart: data.isStart ? false : cp.isStart,
            isFinish: data.isFinish ? false : cp.isFinish,
            isAttendanceStation: data.isAttendanceStation ? false : cp.isAttendanceStation,
          };
        });

        return normalizeCheckpoints(updated);
      });
      Alert.alert('Success', 'Checkpoint details updated.');
    } else {
      // Add Mode
      let serverCheckpoint: Checkpoint | null = null;
      try {
        const res = await createCheckpoint(
          eventId,
          {
            name: data.name || 'New Checkpoint',
            latitude: data.latitude || activeEvent?.latitude || 3.1492,
            longitude: data.longitude || activeEvent?.longitude || 101.6938,
            clueText: data.clueText || '',
            taskDescription: data.taskDescription || '',
            scorePoints: data.scorePoints || 150,
            isStart: !!data.isStart,
            isFinish: !!data.isFinish,
            isAttendanceStation: !!data.isAttendanceStation,
            isHiddenInMap: !!data.isHiddenInMap,
          },
          token
        );
        if (res && res.checkpoint) {
          serverCheckpoint = res.checkpoint;
        }
      } catch (err) {
        console.warn('Backend createCheckpoint warning:', err);
      }

      const newCpId = serverCheckpoint?.id || data.id || `CP-${Math.floor(Math.random() * 900 + 100)}`;
      const newCheckpoint: Checkpoint = serverCheckpoint || {
        id: newCpId,
        name: data.name || 'New Checkpoint',
        latitude: data.latitude || activeEvent?.latitude || 3.1492,
        longitude: data.longitude || activeEvent?.longitude || 101.6938,
        clueText: data.clueText || '',
        taskDescription: data.taskDescription || '',
        scorePoints: data.scorePoints || 150,
        statusPerTeam: {},
        isStart: data.isStart,
        isFinish: data.isFinish,
        isAttendanceStation: data.isAttendanceStation,
        isHiddenInMap: data.isHiddenInMap,
      };

      setCheckpoints(prev => {
        let updated = prev.map(cp => ({
          ...cp,
          isStart: data.isStart ? false : cp.isStart,
          isFinish: data.isFinish ? false : cp.isFinish,
          isAttendanceStation: data.isAttendanceStation ? false : cp.isAttendanceStation,
        }));
        return normalizeCheckpoints([...updated, newCheckpoint]);
      });
      Alert.alert('Success', 'New checkpoint added.');
    }

    setModalVisible(false);
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Manage Checkpoints</Text>
            <Text style={styles.headerSubtitle}>Configure clues, tasks, and marshals</Text>
          </View>
        </View>
        <View style={{ padding: SPACING.md }}>
          <SkeletonLoader type="list" />
        </View>
      </SafeAreaView>
    );
  }

  return (

    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Manage Checkpoints</Text>
          <Text style={styles.headerSubtitle}>Configure clues, tasks, and marshals</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Add Checkpoint Button */}
        <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={handleAddPress}>
          <Ionicons name="add-circle" size={20} color={COLORS.textLight} />
          <Text style={styles.addButtonText}>Add New Checkpoint</Text>
        </TouchableOpacity>

        {checkpoints.length === 0 ? (
          <EmptyState
            title="No Checkpoints Configured"
            description="Please add a new checkpoint using the button above to start the clue hunt challenge."
            icon="flag-outline"
            actionLabel="Add First Checkpoint"
            onAction={handleAddPress}
          />
        ) : (

          checkpoints.map((cp, index) => (
            <Card key={cp.id} role="admin" style={styles.cpCard} borderAccent="left">
              {/* Header Title Row */}
              <View style={styles.cardHeader}>
                <View style={styles.cpIconContainer}>
                  <Text style={[styles.cpIconText, (cp.isStart || cp.isFinish) && { fontSize: 9 }]}>
                    {cp.isStart ? 'START' : cp.isFinish ? 'FINISH' : cp.id.startsWith('CP-') ? cp.id.replace('CP-', '') : `CP ${index}`}
                  </Text>
                </View>

                <View style={styles.cpMetaText}>
                  <Text style={styles.cpNameText} numberOfLines={1}>{cp.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <Text style={styles.cpPointsText}>Points: {cp.scorePoints} Pts</Text>
                    {cp.isStart && <Badge label="START" state="success" />}
                    {cp.isFinish && <Badge label="FINISH" state="danger" />}
                    {cp.isHiddenInMap && <Badge label="HIDDEN ON MAP" state="warning" />}
                  </View>
                </View>
              </View>

              {/* Action Toolbar Row */}
              <View style={styles.actionToolbarRow}>
                {!cp.isStart && !cp.isFinish && (
                  <View style={styles.reorderGroup}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn, index <= 1 && { opacity: 0.3 }]}
                      disabled={index <= 1}
                      onPress={() => handleMoveUp(index)}
                    >
                      <Ionicons name="arrow-up" size={14} color={COLORS.admin.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn, index >= checkpoints.length - 2 && { opacity: 0.3 }]}
                      disabled={index >= checkpoints.length - 2}
                      onPress={() => handleMoveDown(index)}
                    >
                      <Ionicons name="arrow-down" size={14} color={COLORS.admin.primary} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                  {/* Hide in map toggle button */}
                  <TouchableOpacity
                    style={[
                      styles.actionChipBtn,
                      cp.isHiddenInMap ? styles.hiddenChipBtnActive : styles.hiddenChipBtnInactive
                    ]}
                    onPress={() => {
                      setCheckpoints(prev =>
                        prev.map(item =>
                          item.id === cp.id ? { ...item, isHiddenInMap: !item.isHiddenInMap } : item
                        )
                      );
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={cp.isHiddenInMap ? "eye-off" : "eye-outline"}
                      size={14}
                      color={cp.isHiddenInMap ? COLORS.danger : COLORS.admin.primary}
                    />
                    <Text style={[
                      styles.actionChipText,
                      { color: cp.isHiddenInMap ? COLORS.danger : COLORS.admin.primary }
                    ]}>
                      {cp.isHiddenInMap ? 'Hidden' : 'Visible on Map'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => handleEditPress(cp)}
                  >
                    <Ionicons name="pencil" size={14} color={COLORS.admin.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDeletePress(cp.id)}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>


              <View style={styles.divider} />

              {/* Clue Text Preview */}
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Hunt Clue:</Text>
                <Text style={styles.detailValueText} numberOfLines={2}>
                  {cp.clueText || 'No clue entered.'}
                </Text>
              </View>

              {/* Task Description */}
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Physical Task:</Text>
                <Text style={styles.detailValueText} numberOfLines={2}>
                  {cp.taskDescription || 'No physical task entered.'}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* CRUD Modal Form */}
      <CheckpointFormModal
        visible={modalVisible}
        checkpoint={selectedCheckpoint}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveCheckpoint}
        checkpointsCount={checkpoints.length}
      />
      
      {/* Field Journal Custom Delete Confirmation Modal */}
      <CustomModalDialog
        visible={deleteModalVisible}
        variant="danger"
        icon="trash-outline"
        title="Delete Checkpoint? ⚠️"
        message="Are you sure you want to delete this checkpoint? This action cannot be undone."
        buttons={[
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'DELETE',
            style: 'destructive',
            onPress: async () => {
              if (deleteTargetId) {
                const eventId = activeEvent?.id || selectedEventId || user?.eventId || '';
                if (!eventId) return;
                const token = user?.idToken;
                try {
                  await deleteCheckpoint(eventId, deleteTargetId, token, true);
                } catch (err) {
                  console.warn('Backend deleteCheckpoint warning:', err);
                }
                setCheckpoints(prev => prev.filter(cp => cp.id !== deleteTargetId));
              }
            },
          },
        ]}
        onDismiss={() => setDeleteModalVisible(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  scrollContainer: {
    padding: SPACING.md,
    flexGrow: 1,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.admin.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  addButtonText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  cpCard: {
    padding: SPACING.md,
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cpTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  cpIconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.admin.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpIconText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  cpMetaText: {
    flex: 1,
  },
  cpNameText: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  cpPointsText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  reorderGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  actionChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  hiddenChipBtnActive: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  hiddenChipBtnInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.admin.primaryLight,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editBtn: {
    borderColor: COLORS.admin.primary,
    backgroundColor: COLORS.admin.primaryLight,
  },
  deleteBtn: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  detailItem: {
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValueText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  marshalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marshalLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  marshalName: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
});
