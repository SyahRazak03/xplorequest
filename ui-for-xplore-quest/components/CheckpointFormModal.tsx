import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Checkpoint } from '../types';
import { PrimaryButton, SecondaryButton } from './';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { useApp } from '../AppContext';

interface CheckpointFormModalProps {
  visible: boolean;
  checkpoint: Checkpoint | null; // Null means Add mode, else Edit mode
  onClose: () => void;
  onSave: (data: Partial<Checkpoint>) => void;
  checkpointsCount: number;
}

export const CheckpointFormModal: React.FC<CheckpointFormModalProps> = ({
  visible,
  checkpoint,
  onClose,
  onSave,
  checkpointsCount,
}) => {
  const { rules, activeEvent } = useApp();
  const [name, setName] = useState('');
  const [clueText, setClueText] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [cpNumber, setCpNumber] = useState('');
  const [cpType, setCpType] = useState<'standard' | 'start' | 'finish'>('standard');
  const [scorePoints, setScorePoints] = useState('150');
  const [isHiddenInMap, setIsHiddenInMap] = useState(false);
  const [isAttendanceStation, setIsAttendanceStation] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Populate data when modal opens in edit mode
  useEffect(() => {
    if (visible) {
      if (checkpoint) {
        setName(checkpoint.name);
        setClueText(checkpoint.clueText);
        setTaskDescription(checkpoint.taskDescription);
        setCpNumber(checkpoint.id.replace('CP-', '').replace(/^0+/, ''));
        setCpType(checkpoint.isStart ? 'start' : checkpoint.isFinish ? 'finish' : 'standard');
        setScorePoints(checkpoint.scorePoints.toString());
        setIsHiddenInMap(!!checkpoint.isHiddenInMap);
        setIsAttendanceStation(!!checkpoint.isAttendanceStation);
        setImageUri(null); // Local picked image reset
      } else {
        // Reset inputs for add mode
        setName('');
        setClueText('');
        setTaskDescription('');
        setCpType('standard');
        setCpNumber((checkpointsCount + 1).toString());
        setScorePoints('150');
        setIsHiddenInMap(false);
        setIsAttendanceStation(false);
        setImageUri(null);
      }
    }
  }, [visible, checkpoint, checkpointsCount]);


  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Kebenaran Diperlukan', 'Sila benarkan aplikasi mengakses galeri gambar anda untuk memuat naik klu.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    const isSpecial = cpType === 'start' || cpType === 'finish';

    if (!isSpecial && (!cpNumber.trim() || isNaN(Number(cpNumber)))) {
      Alert.alert('Ralat', 'Sila masukkan nombor pos kawalan yang sah.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Ralat', 'Sila masukkan nama pos kawalan.');
      return;
    }
    if (!clueText.trim()) {
      Alert.alert('Ralat', 'Sila masukkan klu pos kawalan.');
      return;
    }
    if (!taskDescription.trim()) {
      Alert.alert('Ralat', 'Sila masukkan penerangan tugasan.');
      return;
    }
    if (rules.pointsSystemEnabled && (!scorePoints.trim() || isNaN(Number(scorePoints)))) {
      Alert.alert('Ralat', 'Sila masukkan jumlah mata yang sah.');
      return;
    }

    // Format ID: special or numeric padding
    const formattedId = isSpecial
      ? (cpType === 'start' ? 'CP-START' : 'CP-TAMAT')
      : `CP-${cpNumber.trim().padStart(3, '0')}`;


    // Call save callback
    onSave({
      id: formattedId,
      name,
      clueText,
      taskDescription,
      scorePoints: rules.pointsSystemEnabled ? (Number(scorePoints) || 0) : 0,
      latitude: checkpoint?.latitude || activeEvent?.latitude || 3.1492,
      longitude: checkpoint?.longitude || activeEvent?.longitude || 101.6938,
      statusPerTeam: checkpoint?.statusPerTeam || {},
      isStart: cpType === 'start',
      isFinish: cpType === 'finish',
      isAttendanceStation,
      isHiddenInMap,
    });

  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {checkpoint ? 'Kemaskini Pos Kawalan' : 'Tambah Pos Kawalan Baru'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Checkpoint Type Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jenis Pos Kawalan (Type)</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    cpType === 'standard' && styles.typeOptionSelected,
                  ]}
                  onPress={() => setCpType('standard')}
                >
                  <Text style={[styles.typeText, cpType === 'standard' && styles.typeTextSelected]}>
                    Biasa
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    cpType === 'start' && styles.typeOptionSelectedStart,
                  ]}
                  onPress={() => setCpType('start')}
                >
                  <Text style={[styles.typeText, cpType === 'start' && styles.typeTextSelectedStart]}>
                    MULA (Start)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    cpType === 'finish' && styles.typeOptionSelectedFinish,
                  ]}
                  onPress={() => setCpType('finish')}
                >
                  <Text style={[styles.typeText, cpType === 'finish' && styles.typeTextSelectedFinish]}>
                    TAMAT (Finish)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Checkpoint Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombor Pos Kawalan (Contoh: 1, 2, 3)</Text>
              <TextInput
                style={styles.textInput}
                value={cpNumber}
                onChangeText={setCpNumber}
                placeholder="cth: 1"
                keyboardType="numeric"
              />
            </View>

            {/* Checkpoint Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Pos Kawalan (Checkpoint)</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="cth: Jambatan Gantung Titiwangsa"
              />
            </View>

            {/* Clue Text */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Klu Bertulis Pos Kawalan</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={clueText}
                onChangeText={setClueText}
                placeholder="Masukkan petunjuk untuk mencari pos kawalan ini..."
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Task Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deskripsi Tugasan di Pos Kawalan</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={taskDescription}
                onChangeText={setTaskDescription}
                placeholder="Apakah cabaran fizikal yang mesti diselesaikan oleh pasukan?"
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Attendance Station Switch */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isAttendanceStation ? '#FEF3C7' : COLORS.background,
              borderRadius: RADIUS.md,
              padding: SPACING.md,
              marginVertical: SPACING.xs,
              borderWidth: 1,
              borderColor: isAttendanceStation ? COLORS.warning : COLORS.border,
            }}>
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Ionicons name="clipboard-outline" size={18} color={isAttendanceStation ? COLORS.warning : COLORS.admin.primary} />
                  <Text style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text }}>
                    Stesen Kehadiran (Attendance Station)
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 15 }}>
                  Pos utama untuk pendaftaran pendaftaran dan kebenaran &apos;Mula Perlumbaan&apos;. Hadkan 1 stesen setiap acara.
                </Text>
              </View>
              <Switch
                value={isAttendanceStation}
                onValueChange={setIsAttendanceStation}
                trackColor={{ false: COLORS.border, true: COLORS.warning }}
                thumbColor={isAttendanceStation ? '#FFFFFF' : '#F4F4F5'}
              />
            </View>

            {/* Hide Checkpoint in Map Switch */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isHiddenInMap ? 'rgba(239, 68, 68, 0.08)' : COLORS.background,
              borderRadius: RADIUS.md,
              padding: SPACING.md,
              marginVertical: SPACING.md,
              borderWidth: 1,
              borderColor: isHiddenInMap ? COLORS.danger : COLORS.border,
            }}>
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Ionicons name={isHiddenInMap ? "eye-off-outline" : "eye-outline"} size={18} color={isHiddenInMap ? COLORS.danger : COLORS.admin.primary} />
                  <Text style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text }}>
                    Sembunyi Pos di Peta (Hide in Map)
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 15 }}>
                  Jika diaktifkan, peserta hanya boleh melihat lokasi pos ini selepas mereka menyelesaikan pos sebelumnya.
                </Text>
              </View>
              <Switch
                value={isHiddenInMap}
                onValueChange={setIsHiddenInMap}
                trackColor={{ false: COLORS.border, true: COLORS.danger }}
                thumbColor={isHiddenInMap ? '#FFFFFF' : '#F4F4F5'}
              />
            </View>

            {/* Checkpoint Score Points (Only render if point system enabled!) */}
            {rules.pointsSystemEnabled && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Jumlah Mata Ganjaran (Score Points)</Text>
                <TextInput
                  style={styles.textInput}
                  value={scorePoints}
                  onChangeText={setScorePoints}
                  placeholder="cth: 150"
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* Image Picker */}
            <View style={styles.inputGroup}>

              <Text style={styles.label}>Gambar Klu Pos Kawalan</Text>
              <View style={styles.imagePickerWrapper}>
                {imageUri ? (
                  <View style={styles.previewImageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageBadge}
                      onPress={() => setImageUri(null)}
                    >
                      <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.imagePickerBtn}
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="image-outline" size={24} color={COLORS.admin.primary} />
                    <Text style={styles.imagePickerBtnText}>Muat Naik Gambar Klu</Text>
                    <Text style={styles.imagePickerBtnSubtext}>Pilih dari galeri peranti</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalFooter}>
            <SecondaryButton
              label="Batal"
              onPress={onClose}
              variant="outline"
              role="admin"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Simpan Pos Kawalan"
              onPress={handleSave}
              role="admin"
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
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
  closeBtn: {
    padding: 4,
  },
  formContainer: {
    gap: SPACING.md,
    paddingBottom: SPACING.md,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  typeOptionSelected: {
    borderColor: COLORS.admin.primary,
    backgroundColor: COLORS.admin.primaryLight,
  },
  typeOptionSelectedStart: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  typeOptionSelectedFinish: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  typeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  typeTextSelected: {
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  typeTextSelectedStart: {
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  typeTextSelectedFinish: {
    color: COLORS.danger,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  imagePickerWrapper: {
    marginTop: 4,
  },
  imagePickerBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  imagePickerBtnText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    marginTop: 6,
  },
  imagePickerBtnSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  previewImageContainer: {
    width: '100%',
    height: 150,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
  },
});
