import React, { useState, useEffect } from 'react';
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
import { Checkpoint, EventConfig } from '../types';
import { PrimaryButton, SecondaryButton, Card, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { crewLogin } from '../services/authService';
import { getCheckpoints } from '../services/checkpointService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CrewSelectCheckpoint'>;

export default function CrewSelectCheckpointScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login, activeEvent, events: appEvents, setActiveEvent, checkpoints: appCheckpoints, crewPinCode } = useApp();

  // Selected event state
  const [selectedEventId, setSelectedEventId] = useState<string>(
    activeEvent?.id || (appEvents.length > 0 ? appEvents[0].id : '')
  );

  // Checkpoints list for current event
  const [checkpointsList, setCheckpointsList] = useState<Checkpoint[]>(
    appCheckpoints.length > 0 ? appCheckpoints : []
  );

  // Selected checkpoint state
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>(
    (appCheckpoints.length > 0 ? appCheckpoints[0]?.id : '') || ''
  );

  const [pinCode, setPinCode] = useState('');
  const [marshalId, setMarshalId] = useState('');

  const [isPinFocused, setIsPinFocused] = useState(false);
  const [isMarshalFocused, setIsMarshalFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentEvent = appEvents.find((e) => e.id === selectedEventId) || appEvents[0] || {
    id: selectedEventId,
    name: 'Acara XploreQuest',
    locationName: '',
    date: '',
  };

  // Load checkpoints whenever selectedEventId changes
  useEffect(() => {
    async function loadCheckpoints() {
      try {
        const fetched = await getCheckpoints(selectedEventId);
        if (fetched && fetched.length > 0) {
          setCheckpointsList(fetched);
          if (!fetched.some((cp) => cp.id === selectedCheckpointId)) {
            setSelectedCheckpointId(fetched[0].id);
          }
        } else {
          setCheckpointsList(appCheckpoints);
        }
      } catch {
        if (appCheckpoints.length > 0) {
          setCheckpointsList(appCheckpoints);
        }
      }
    }
    loadCheckpoints();
  }, [selectedEventId]);

  const handleSelectEvent = (event: EventConfig) => {
    setSelectedEventId(event.id);
    setActiveEvent(event);
  };

  const selectedCheckpoint = checkpointsList.find((cp) => cp.id === selectedCheckpointId) || checkpointsList[0];
  const isAttendanceStation = Boolean(selectedCheckpoint?.isAttendanceStation);

  const handleEnterCrewView = async () => {
    if (isAttendanceStation && !marshalId.trim()) {
      Alert.alert('Ralat', 'Pos Kehadiran memerlukan ID Marshal yang sah.');
      return;
    }

    if (!pinCode.trim()) {
      Alert.alert('Ralat', 'Sila masukkan PIN Krew.');
      return;
    }

    setLoading(true);
    try {
      const result = await crewLogin(
        isAttendanceStation ? marshalId.trim() : undefined,
        pinCode.trim(),
        selectedCheckpointId,
        selectedEventId,
        crewPinCode
      );

      login('crew', {
        id: result.uid,
        name: result.name,
        role: 'crew',
        email: undefined,
        checkpointId: result.checkpointId,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Log masuk gagal. Sila periksa PIN/Marshal ID.';
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
              Sila pilih Acara Penganjur dan Pos Kawalan tugas anda sebelum mengesahkan PIN Krew.
            </Text>
          </View>

          {/* STEP 1: Event Selector */}
          <Text style={styles.sectionTitle}>1. Pilih Acara Penganjur (Event)</Text>
          <View style={styles.eventList}>
            {appEvents.map((evt) => {
              const isSelected = evt.id === selectedEventId;
              return (
                <TouchableOpacity
                  key={evt.id}
                  activeOpacity={0.8}
                  style={[
                    styles.eventItem,
                    isSelected && {
                      borderColor: COLORS.crew.primary,
                      backgroundColor: COLORS.crew.primaryLight,
                    },
                  ]}
                  onPress={() => handleSelectEvent(evt)}
                >
                  <View style={styles.eventInfo}>
                    <View
                      style={[
                        styles.eventBadgeIcon,
                        { backgroundColor: isSelected ? COLORS.crew.primary : COLORS.border },
                      ]}
                    >
                      <Ionicons name="trophy-outline" size={16} color={isSelected ? '#FFFFFF' : COLORS.text} />
                    </View>
                    <View style={styles.eventTextDetails}>
                      <Text style={[styles.eventName, isSelected && { color: COLORS.crew.primaryDark, fontWeight: '700' }]}>
                        {evt.name}
                      </Text>
                      <Text style={styles.eventMetaText}>
                        📍 {evt.locationName || 'Tasik Titiwangsa'} • 📅 {evt.date || '2026-03-25'}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.crew.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* STEP 2: Checkpoint Selector */}
          <Text style={styles.sectionTitle}>
            2. Pilih Pos Kawalan Tugas ({currentEvent.name})
          </Text>

          <View style={styles.checkpointList}>
            {checkpointsList.map((cp) => {
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.checkpointName, isSelected && { color: COLORS.crew.primaryDark, fontWeight: '700' }]}>
                          {cp.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {cp.isAttendanceStation && (
                          <Badge label="Stesen Kehadiran" state="warning" />
                        )}
                        {cp.isStart && (
                          <Badge label="MULA" state="success" />
                        )}
                        {cp.isFinish && (
                          <Badge label="TAMAT" state="danger" />
                        )}
                        <Text style={styles.checkpointPoints}>{cp.scorePoints} Mata Cabaran</Text>
                      </View>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.crew.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* STEP 3: Credentials Validation */}
          <Text style={styles.sectionTitle}>3. Pengesahan Krew</Text>
          <Card style={styles.formCard} role="crew">
            {isAttendanceStation && (
              <View style={styles.attendanceBanner}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.warning} />
                <Text style={styles.attendanceBannerText}>
                  Stesen Kehadiran: Memerlukan ID Marshal berdaftar dan PIN Keselamatan.
                </Text>
              </View>
            )}

            {isAttendanceStation && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ID Krew Marshal</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    isMarshalFocused && { borderColor: COLORS.crew.primary },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={isMarshalFocused ? COLORS.crew.primary : COLORS.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: USR-CREW-002"
                    placeholderTextColor={COLORS.textMuted}
                    value={marshalId}
                    onChangeText={setMarshalId}
                    autoCapitalize="characters"
                    onFocus={() => setIsMarshalFocused(true)}
                    onBlur={() => setIsMarshalFocused(false)}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PIN Keselamatan Krew</Text>
              <View
                style={[
                  styles.inputWrapper,
                  isPinFocused && { borderColor: COLORS.crew.primary },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={isPinFocused ? COLORS.crew.primary : COLORS.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="PIN Keselamatan (4 digit)"
                  placeholderTextColor={COLORS.textMuted}
                  value={pinCode}
                  onChangeText={setPinCode}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  onFocus={() => setIsPinFocused(true)}
                  onBlur={() => setIsPinFocused(false)}
                />
              </View>
            </View>
          </Card>

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
  sectionTitle: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  eventList: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  eventItem: {
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
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  eventTextDetails: {
    flex: 1,
  },
  eventName: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.text,
  },
  eventMetaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  checkpointList: {
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
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
  formCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  attendanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  attendanceBannerText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
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
    backgroundColor: '#FBE4D7' + '1A',
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
  submitBtn: {
    marginBottom: SPACING.xl,
  },
});
