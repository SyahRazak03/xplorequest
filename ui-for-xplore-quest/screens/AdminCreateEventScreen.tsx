import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, PrimaryButton, SecondaryButton, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function AdminCreateEventScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { setActiveEvent, setCrewPinCode } = useApp();

  // Form Fields State
  const [eventName, setEventName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [eventDate, setEventDate] = useState('27 Jun 2026');
  const [startTime, setStartTime] = useState('08:00 AM');
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [crewCode, setCrewCode] = useState('');

  // Success State
  const [isSuccess, setIsSuccess] = useState(false);

  const generateRandomCrewCode = () => {
    return Math.floor(Math.random() * 9000 + 1000).toString();
  };

  // Generate initial code on mount
  useEffect(() => {
    setCrewCode(generateRandomCrewCode());
  }, []);



  const handleIncrement = () => {
    if (maxTeamSize < 6) {
      setMaxTeamSize(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (maxTeamSize > 2) {
      setMaxTeamSize(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (!eventName.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Nama Acara.');
      return;
    }
    if (!locationName.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Lokasi Acara.');
      return;
    }
    if (!eventDate.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Tarikh Acara.');
      return;
    }
    if (!startTime.trim()) {
      Alert.alert('Ralat', 'Sila masukkan Masa Mula.');
      return;
    }

    // Update the app context with the new event configuration
    setActiveEvent({
      id: `EV-${Math.floor(Math.random() * 900 + 100)}`,
      name: eventName,
      date: eventDate,
      maxDurationSeconds: 14400, // 4 hours default
      locationName: locationName,
      totalCheckpoints: 8,
    });


    setCrewPinCode(crewCode);
    setIsSuccess(true);
  };


  const handleBackToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToDashboard}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Penyediaan Acara Baru</Text>
              <Text style={styles.headerSubtitle}>Stage 4.1 Admin Console (ADM-01)</Text>
            </View>
          </View>

          {isSuccess ? (
            /* Success State View */
            <View style={styles.successContainer}>
              <View style={styles.successBadgeContainer}>
                <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
                <Text style={styles.successTitle}>Acara Berjaya Dicipta!</Text>
                <Text style={styles.successSubtitle}>
                  Sistem kini sedia untuk menerima pendaftaran kumpulan.
                </Text>
              </View>



              {/* Crew Access PIN Banner */}
              <View style={[styles.shareBanner, { marginTop: SPACING.md, backgroundColor: COLORS.crew.primaryLight, borderColor: COLORS.crew.primary }]}>
                <Text style={[styles.shareLabel, { color: COLORS.crew.primary }]}>PIN MASUK MARSHAL (CREW)</Text>
                <Text style={[styles.shareCode, { color: COLORS.crew.primary }]}>{crewCode}</Text>
                <TouchableOpacity
                  style={styles.shareAction}
                  onPress={() => Alert.alert('Kongsi PIN', 'PIN Crew telah disalin!')}
                >
                  <Ionicons name="copy-outline" size={16} color={COLORS.crew.primary} />
                  <Text style={[styles.shareActionText, { color: COLORS.crew.primary }]}>Salin PIN</Text>
                </TouchableOpacity>
              </View>


              {/* Summary Card */}
              <Card role="admin" title="Ringkasan Maklumat Acara" borderAccent="left">
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Nama Acara</Text>
                    <Text style={styles.summaryValue}>{eventName}</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Lokasi</Text>
                    <Text style={styles.summaryValue}>{locationName}</Text>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Tarikh</Text>
                      <Text style={styles.summaryValue}>{eventDate}</Text>
                    </View>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Masa Mula</Text>
                      <Text style={styles.summaryValue}>{startTime}</Text>
                    </View>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Saiz Max Kumpulan</Text>
                      <Text style={styles.summaryValue}>{maxTeamSize} Orang</Text>
                    </View>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Had Masa</Text>
                      <Text style={styles.summaryValue}>4 Jam</Text>
                    </View>
                  </View>
                </View>
              </Card>

              <PrimaryButton
                label="Ke Papan Pemuka Admin"
                onPress={handleBackToDashboard}
                role="admin"
                style={styles.actionButton}
              />
            </View>
          ) : (
            /* Creation Form View */
            <View style={styles.formContainer}>
              <Card role="admin" title="Konfigurasi Parameter Acara" borderAccent="top">
                {/* Event Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nama Acara</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: Cabaran Rimba 2026"
                    value={eventName}
                    onChangeText={setEventName}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                {/* Location Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Lokasi Acara</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: Taman Tasik Titiwangsa, KL"
                    value={locationName}
                    onChangeText={setLocationName}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                {/* Date & Time Row */}
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Tarikh</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="27 Jun 2026"
                      value={eventDate}
                      onChangeText={setEventDate}
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                    <Text style={styles.label}>Masa Mula</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="08:00 AM"
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                </View>

                {/* Stepper: Max Team Size */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Had Maksimum Ahli Kumpulan</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={[styles.stepperButton, maxTeamSize <= 2 && styles.stepperButtonDisabled]}
                      onPress={handleDecrement}
                      disabled={maxTeamSize <= 2}
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        color={maxTeamSize <= 2 ? COLORS.textMuted : COLORS.admin.primary}
                      />
                    </TouchableOpacity>

                    <View style={styles.stepperValueContainer}>
                      <Text style={styles.stepperValueText}>{maxTeamSize}</Text>
                      <Text style={styles.stepperValueLabel}>Orang / Kumpulan</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.stepperButton, maxTeamSize >= 6 && styles.stepperButtonDisabled]}
                      onPress={handleIncrement}
                      disabled={maxTeamSize >= 6}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        color={maxTeamSize >= 6 ? COLORS.textMuted : COLORS.admin.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>



              </Card>

              {/* Submit Action */}
              <PrimaryButton
                label="Cipta & Lancar Acara"
                onPress={handleSubmit}
                role="admin"
                style={styles.actionButton}
                icon={<Ionicons name="rocket-outline" size={18} color={COLORS.textLight} />}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  formContainer: {
    gap: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: 8,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  stepperButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F3F2',
  },
  stepperValueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  stepperValueLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  codeContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  codeDisplayBox: {
    flex: 1,
    backgroundColor: COLORS.admin.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeDisplayText: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    letterSpacing: 4,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    gap: 4,
  },
  regenerateText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  codeHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  actionButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  successContainer: {
    gap: SPACING.lg,
  },
  successBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
    marginTop: SPACING.md,
  },
  successSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  shareBanner: {
    backgroundColor: '#E3EDF7',
    borderWidth: 2,
    borderColor: COLORS.admin.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    letterSpacing: 1.5,
  },
  shareCode: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    letterSpacing: 6,
    marginVertical: SPACING.xs,
  },
  shareAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.admin.primary,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    gap: 4,
    marginTop: 4,
    ...SHADOWS.sm,
  },
  shareActionText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  summaryGrid: {
    gap: SPACING.md,
  },
  summaryItem: {
    flexDirection: 'column',
  },
  summaryItemRow: {
    flexDirection: 'row',
  },
  summaryItemHalf: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: 2,
  },
});
