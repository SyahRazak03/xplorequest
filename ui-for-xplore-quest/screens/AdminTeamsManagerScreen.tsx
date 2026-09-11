import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Team } from '../mockData';
import { Card, PrimaryButton, Badge, OfflineStatusChip, EmptyState, CustomModalDialog } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdminTeamsManager'>;

export default function AdminTeamsManagerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { teams, setTeams, theme } = useApp();

  // Expanded card state
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Form Fields State
  const [teamName, setTeamName] = useState('');
  const [memberCount, setMemberCount] = useState('4');
  const [leaderName, setLeaderName] = useState('');
  const [membersList, setMembersList] = useState('');

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [phone, setPhone] = useState('');

  const handleOpenAddModal = () => {
    setEditingTeam(null);
    setTeamName('');
    setMemberCount('4');
    setLeaderName('');
    setMembersList('');
    setPhone('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setMemberCount(team.memberCount.toString());
    setLeaderName(team.leaderName || '');
    setMembersList(team.membersList || '');
    setPhone(team.phone || '');
    setModalVisible(true);
  };

  const handleSaveTeam = () => {
    if (!teamName.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Nama Kumpulan.');
      return;
    }
    const count = parseInt(memberCount, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Ralat', 'Sila masukkan Jumlah Ahli yang sah.');
      return;
    }

    if (editingTeam) {
      // Edit mode
      setTeams(prev =>
        prev.map(t =>
          t.id === editingTeam.id
            ? {
                ...t,
                name: teamName,
                memberCount: count,
                leaderName,
                membersList,
                phone,
              }
            : t
        )
      );
      Alert.alert('Berjaya', 'Maklumat kumpulan telah dikemas kini.');
    } else {
      // Add mode
      const newTeam: Team = {
        id: `TEAM-${Math.floor(Math.random() * 900 + 100)}`,
        name: teamName,
        status: 'pending',
        memberCount: count,
        startCheckpointId: 'CP-START',
        currentCheckpointId: 'CP-START',
        completedCheckpointIds: [],
        skippedCheckpointIds: [],
        leaderName,
        membersList,
        phone,
      };
      setTeams(prev => [...prev, newTeam]);
      Alert.alert('Berjaya', 'Kumpulan baharu telah didaftarkan.');
    }
    setModalVisible(false);
  };

  const handleDeleteTeam = (teamId: string) => {
    setDeleteTargetId(teamId);
    setDeleteModalVisible(true);
  };

  const handleToggleStatus = (team: Team) => {
    const newStatus = team.status === 'approved' ? 'pending' : 'approved';
    setTeams(prev =>
      prev.map(t => (t.id === team.id ? { ...t, status: newStatus } : t))
    );
    Alert.alert(
      'Status Dikemaskini',
      `Kumpulan "${team.name}" kini ${newStatus === 'approved' ? 'diluluskan' : 'ditunda kelulusan'}.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Urus Kumpulan Peserta</Text>
          <Text style={styles.headerSubtitle}>Daftar & Edit data pendaftaran kumpulan</Text>
        </View>
        <OfflineStatusChip />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Add Team Button */}
        <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={handleOpenAddModal}>
          <Ionicons name="add-circle" size={20} color={COLORS.textLight} />
          <Text style={styles.addButtonText}>Tambah Kumpulan Baru</Text>
        </TouchableOpacity>

        {teams.length === 0 ? (
          <EmptyState
            title="Tiada Kumpulan Didatar"
            description="Sila daftarkan kumpulan baharu menggunakan butang di atas untuk memulakan cabaran."
            icon="people-outline"
            actionLabel="Daftar Kumpulan Pertama"
            onAction={handleOpenAddModal}
          />
        ) : (
          teams.map(team => {
            const isExpanded = expandedTeamId === team.id;
            return (
              <View key={team.id} style={{ marginBottom: SPACING.md }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setExpandedTeamId(isExpanded ? null : team.id)}
                >
                  <Card
                    role="admin"
                    borderAccent="left"
                    style={[styles.teamCard, team.status === 'approved' ? styles.approvedBorder : styles.pendingBorder]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.teamTitleWrapper}>
                        <Text style={styles.teamName}>{team.name}</Text>
                        <Text style={styles.teamId}>ID: {team.id}</Text>
                      </View>
                      <View style={styles.badgeCol}>
                        <Badge
                          label={team.status === 'approved' ? 'Lulus' : 'Tertunda'}
                          state={team.status === 'approved' ? 'success' : 'warning'}
                        />
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={COLORS.textMuted}
                        />
                      </View>
                    </View>

                    {isExpanded && (
                      <View style={{ marginTop: SPACING.md }}>
                        <View style={styles.divider} />
                        
                        {/* Registration fields list */}
                        <View style={styles.detailsList}>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Ketua Kumpulan:</Text>
                            <Text style={styles.detailValue}>{team.leaderName || 'N/A'}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>No. Telefon:</Text>
                            <Text style={styles.detailValue}>{team.phone || 'N/A'}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Jumlah Ahli:</Text>
                            <Text style={styles.detailValue}>{team.memberCount} Orang</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Senarai Nama Ahli:</Text>
                            <Text style={[styles.detailValue, { flex: 1, textAlign: 'right', marginLeft: 16 }]}>
                              {team.membersList || 'N/A'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Action buttons */}
                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.statusBtn]}
                            onPress={() => handleToggleStatus(team)}
                          >
                            <Ionicons name={team.status === 'approved' ? 'close-circle' : 'checkmark-circle'} size={15} color={COLORS.admin.primary} />
                            <Text style={styles.actionBtnText}>
                              {team.status === 'approved' ? 'Tunda' : 'Luluskan'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, styles.editBtn]}
                            onPress={() => handleOpenEditModal(team)}
                          >
                            <Ionicons name="pencil" size={15} color={COLORS.admin.primary} />
                            <Text style={styles.actionBtnText}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, styles.deleteBtn]}
                            onPress={() => handleDeleteTeam(team.id)}
                          >
                            <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Hapus</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Team Form Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTeam ? 'Kemaskini Kumpulan' : 'Daftar Kumpulan Baru'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nama Kumpulan</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: Pasukan Harimau"
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ketua Kumpulan</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nama Penuh Ketua"
                  value={leaderName}
                  onChangeText={setLeaderName}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>No. Telefon Ketua</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: +6012-3456789"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Jumlah Ahli</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Had standard: 4"
                  value={memberCount}
                  onChangeText={setMemberCount}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senarai Ahli (Dipisahkan Koma)</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  placeholder="Abu, Ahmad, Amin"
                  value={membersList}
                  onChangeText={setMembersList}
                  multiline={true}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <PrimaryButton
                label="Simpan Kumpulan"
                onPress={handleSaveTeam}
                role="admin"
                style={{ marginTop: SPACING.md, marginBottom: SPACING.lg }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Field Journal Custom Delete Confirmation Modal */}
      <CustomModalDialog
        visible={deleteModalVisible}
        variant="danger"
        icon="people-circle-outline"
        title="Padam Kumpulan? ⚠️"
        message="Adakah anda pasti mahu memadam kumpulan ini? Tindakan ini tidak boleh diundur."
        buttons={[
          {
            text: 'BATAL',
            style: 'cancel',
          },
          {
            text: 'PADAM',
            style: 'destructive',
            onPress: () => {
              if (deleteTargetId) {
                setTeams(prev => prev.filter(t => t.id !== deleteTargetId));
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
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
  scrollContainer: {
    padding: SPACING.md,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.admin.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  addButtonText: {
    color: COLORS.textLight,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 14,
  },
  teamCard: {
    padding: SPACING.md,
  },
  approvedBorder: {
    borderLeftColor: COLORS.success,
    borderLeftWidth: 4,
  },
  pendingBorder: {
    borderLeftColor: COLORS.pending,
    borderLeftWidth: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamTitleWrapper: {
    flex: 1,
  },
  teamName: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  teamId: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  badgeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  detailsList: {
    gap: SPACING.xs,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
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
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  statusBtn: {
    backgroundColor: '#F8FAFC',
  },
  editBtn: {
    backgroundColor: '#F8FAFC',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.lg,
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
  modalTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  formScroll: {
    flexGrow: 0,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
  },
});
