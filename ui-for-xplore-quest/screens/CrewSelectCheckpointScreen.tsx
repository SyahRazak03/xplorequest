import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { mockCheckpoints } from '../mockData';
import { PrimaryButton, SecondaryButton, Card } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { crewLogin } from '../services/authService';
import { getPendingMarshalId, clearPendingMarshalId } from '../services/authState';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CrewSelectCheckpoint'>;

export default function CrewSelectCheckpointScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login, activeEvent } = useApp();

  const [pinCode, setPinCode] = useState('');
  const [selectedCheckpointId, setSelectedCheckpointId] = useState('CP-002');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEnterCrewView = async () => {
    if (!pinCode.trim()) {
      Alert.alert('Ralat', 'Sila masukkan PIN Krew.');
      return;
    }

    const marshalId = getPendingMarshalId();
    if (!marshalId) {
      Alert.alert('Ralat', 'Sesi marshal tamat. Sila log masuk semula.');
      navigation.goBack();
      return;
    }

    const eventId = activeEvent?.id;
    if (!eventId) {
      Alert.alert('Ralat', 'Tiada acara aktif. Hubungi penganjur.');
      return;
    }

    setLoading(true);
    try {
      const result = await crewLogin(marshalId, pinCode.trim(), selectedCheckpointId, eventId);
      clearPendingMarshalId();
      login('crew', {
        id: result.uid,
        name: result.name,
        role: 'crew',
        email: undefined,
        checkpointId: result.checkpointId,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Log masuk gagal.';
      Alert.alert('Log Masuk Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <SecondaryButton
            label="Kembali"
            onPress={handleBack}
            icon={<Ionicons name="arrow-back-outline" size={18} color={COLORS.crew.primary} />}
            role="crew"
            variant="outline"
            style={styles.backButton}
          />

          {/* Title Section */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="qr-code" size={32} color={COLORS.crew.primary} />
            </View>
            <Text style={styles.title}>Pos Kawalan Krew</Text>
            <Text style={styles.subtitle}>
              Sahkan identiti marshal anda dan pilih pos kawalan (checkpoint) tugas hari ini.
            </Text>
          </View>

          {/* PIN Card */}
          <Card style={styles.formCard} role="crew">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PIN Keselamatan Krew</Text>

              <View
                style={[
                  styles.inputWrapper,
                  isFocused && { borderColor: COLORS.crew.primary },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={isFocused ? COLORS.crew.primary : COLORS.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="PIN Keselamatan"
                  placeholderTextColor={COLORS.textMuted}
                  value={pinCode}
                  onChangeText={setPinCode}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </View>
            </View>
          </Card>

          {/* Checkpoint Picker Header */}
          <Text style={styles.sectionTitle}>Pilih Pos Kawalan Tugas</Text>

          {/* Checkpoints Interactive List */}
          <View style={styles.checkpointList}>
            {mockCheckpoints.map((cp) => {
              const isSelected = cp.id === selectedCheckpointId;
              return (
                <TouchableOpacity
                  key={cp.id}
                  activeOpacity={0.8}
                  style={[
                    styles.checkpointItem,
                    isSelected && {
                      borderColor: COLORS.crew.primary,
                      backgroundColor: COLORS.crew.primaryLight,
                    },
                  ]}
                  onPress={() => setSelectedCheckpointId(cp.id)}
                >
                  <View style={styles.checkpointInfo}>
                    <View
                      style={[
                        styles.bulletPoint,
                        { backgroundColor: isSelected ? COLORS.crew.primary : COLORS.border },
                      ]}
                    >
                      <Text style={[styles.bulletText, isSelected && { color: '#FFFFFF' }]}>
                        {cp.id.replace('CP-', '')}
                      </Text>
                    </View>
                    <View style={styles.checkpointTextDetails}>
                      <Text style={[styles.checkpointName, isSelected && { color: COLORS.crew.primaryDark, fontWeight: '700' }]}>
                        {cp.name}
                      </Text>
                      <Text style={styles.checkpointPoints}>{cp.scorePoints} Mata Cabaran</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.crew.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <PrimaryButton
            label={loading ? 'Mengesahkan...' : 'Masuk Pandangan Krew'}
            onPress={handleEnterCrewView}
            role="crew"
            style={styles.submitBtn}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    flexGrow: 1,
    padding: SPACING.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.crew.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    fontFamily: TYPOGRAPHY.fontFamily.sans,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.sm,
  },
  formCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  inputGroup: {
    marginVertical: SPACING.xs,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FBE4D7' + '1A', // transparent version of primaryLight
    paddingHorizontal: SPACING.sm,
  },
  inputIcon: {
    marginRight: SPACING.xs,
  },
  input: {
    flex: 1,
    height: 48,
    color: COLORS.text,
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: TYPOGRAPHY.fontFamily.sans,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  checkpointList: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    ...SHADOWS.sm,
  },
  checkpointInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bulletPoint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  bulletText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  checkpointTextDetails: {
    flex: 1,
  },
  checkpointName: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.text,
  },
  checkpointPoints: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    marginBottom: SPACING.xl,
  },
});
