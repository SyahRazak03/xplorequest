import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, PrimaryButton, Badge, OfflineStatusChip } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { updatePaymentDetailsService } from '../services/eventService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdminEventDetail'>;

export default function AdminEventDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { activeEvent, setActiveEvent, crewPinCode, attendanceMarshalId, setAttendanceMarshalId, theme } = useApp();

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auto-generate Marshal ID if not present
  React.useEffect(() => {
    if (!attendanceMarshalId) {
      const generatedId = `MSH-${Math.floor(Math.random() * 9000 + 1000)}`;
      setAttendanceMarshalId(generatedId);
    }
  }, [attendanceMarshalId, setAttendanceMarshalId]);

  const handleRegenerateMarshalId = () => {
    const newId = `MSH-${Math.floor(Math.random() * 9000 + 1000)}`;
    setAttendanceMarshalId(newId);
    Alert.alert('Marshal ID Di-Jana Semula', `Marshal ID baharu: ${newId}`);
  };

  // Feature 4C: Payment Details Form State
  const [bankName, setBankName] = useState(activeEvent?.paymentDetails?.bankName || '');
  const [accountHolderName, setAccountHolderName] = useState(activeEvent?.paymentDetails?.accountHolderName || '');
  const [accountNumber, setAccountNumber] = useState(activeEvent?.paymentDetails?.accountNumber || '');
  const [paymentNote, setPaymentNote] = useState(activeEvent?.paymentDetails?.note || '');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const handleSavePaymentDetails = async () => {
    if (!activeEvent) return;
    setIsSavingPayment(true);
    const newDetails = {
      bankName: bankName.trim(),
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      note: paymentNote.trim(),
    };

    try {
      // Call real backend endpoint PATCH /events/:eventId/payment-details
      await updatePaymentDetailsService(activeEvent.id, newDetails);

      setActiveEvent({
        ...activeEvent,
        paymentDetails: newDetails,
      });

      Alert.alert('Berjaya', 'Maklumat akaun bank penganjur telah dikemaskini.');
    } catch (err: any) {
      // Fallback: update AppContext state locally if backend un-reachable
      setActiveEvent({
        ...activeEvent,
        paymentDetails: newDetails,
      });
      Alert.alert('Dikemaskini', 'Maklumat pembayaran dikemaskini dalam sesi ini.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    setCopiedField(label);
    Alert.alert('Berjaya Disalin', `${label} (${text}) telah disalin ke papan keratan.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyBothCredentials = () => {
    const marshalText = attendanceMarshalId
      ? `Marshal ID: ${attendanceMarshalId}`
      : 'Marshal ID: (Belum log masuk / Belum ditugaskan)';
    const text = `*Kredensial Log Masuk Krew & Marshal*\n📌 Pos Kehadiran: ${marshalText}\n🔑 Crew PIN: ${crewPinCode}`;
    Clipboard.setString(text);
    Alert.alert('Kredensial Disalin', 'Kredensial penuh telah disalin untuk dikongsi melalui WhatsApp.');
  };

  if (!activeEvent) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Tiada acara dipilih.</Text>
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
          <Text style={styles.headerTitle}>Urus Acara</Text>
          <Text style={styles.headerSubtitle}>Konfigurasi khusus untuk acara terpilih</Text>
        </View>
        <OfflineStatusChip />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Selected Event Details Card */}
        <Card role="admin" borderAccent="left" title="Maklumat Acara Terpilih">
          <View style={styles.eventInfoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="trophy" size={20} color={COLORS.admin.primary} />
              <Text style={styles.eventTitle}>{activeEvent.name}</Text>
            </View>
            <View style={styles.infoRowSecondary}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.eventDetailText}>{activeEvent.date}</Text>
            </View>
            <View style={styles.infoRowSecondary}>
              <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.eventDetailText} numberOfLines={1}>
                {activeEvent.locationName}
              </Text>
            </View>
          </View>
        </Card>

        {/* Krew & Marshal Credentials Card */}
        <Card role="admin" borderAccent="left" title="Kredensial Log Masuk Krew & Marshal">
          <View style={styles.credentialsContainer}>
            {/* Attendance Station Marshal ID Row */}
            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="id-card-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.credLabel}>Pos Kehadiran (Marshal ID)</Text>
                  <Badge label="Auto-Jana" state="success" />
                </View>
                <Text style={styles.credValue}>{attendanceMarshalId || 'MSH-8492'}</Text>
                <Text style={styles.unassignedSubtext}>
                  Gunakan ID ini untuk log masuk krew di Pos Kehadiran.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleRegenerateMarshalId}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={18} color={COLORS.admin.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(attendanceMarshalId || 'MSH-8492', 'Marshal ID')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={copiedField === 'Marshal ID' ? 'checkmark-circle' : 'copy-outline'}
                    size={18}
                    color={COLORS.admin.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.credDivider} />

            {/* General Shared Crew PIN Row */}
            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="key-outline" size={20} color={COLORS.crew.primary} />
              </View>
              <View style={styles.credMeta}>
                <Text style={styles.credLabel}>Pos Kawalan Am (Crew PIN)</Text>
                <Text style={[styles.credValue, { color: COLORS.crew.primary }]}>{crewPinCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(crewPinCode, 'Crew PIN')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={copiedField === 'Crew PIN' ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={COLORS.crew.primary}
                />
              </TouchableOpacity>
            </View>

            {/* One-Tap Share Action */}
            <TouchableOpacity
              style={styles.shareBothBtn}
              onPress={copyBothCredentials}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={18} color={COLORS.textLight} />
              <Text style={styles.shareBothBtnText}>Salin Semua Kredensial (WhatsApp)</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Web Pre-Registration Information Card (Stage 17) */}
        <Card role="admin" borderAccent="left" title="Konfigurasi Pre-Pendaftaran Web (Stage 17)">
          <View style={styles.credentialsContainer}>
            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="globe-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <Text style={styles.credLabel}>Pautan Form Web (URL Slug)</Text>
                <Text style={[styles.credValue, { fontSize: 13 }]} numberOfLines={1}>
                  xplorequest-cab6c.web.app/registration-form/{activeEvent.urlSlug || 'explorace-tasik-titiwangsa-2026'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(`https://xplorequest-cab6c.web.app/registration-form/${activeEvent.urlSlug || 'explorace-tasik-titiwangsa-2026'}`, 'Pautan Web')}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={18} color={COLORS.admin.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.credDivider} />

            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="cash-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <Text style={styles.credLabel}>Yuran Pendaftaran Kumpulan</Text>
                <Text style={styles.credValue}>
                  {activeEvent.entryFee !== undefined && activeEvent.entryFee > 0 ? `RM ${activeEvent.entryFee.toFixed(2)}` : 'Percuma'}
                </Text>
              </View>
            </View>

            <View style={styles.credDivider} />

            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="card-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <Text style={styles.credLabel}>Maklumat Akaun Bank</Text>
                <Text style={[styles.credValue, { fontSize: 13 }]}>
                  {activeEvent.paymentDetails?.bankName
                    ? `${activeEvent.paymentDetails.bankName} - ${activeEvent.paymentDetails.accountNumber} (${activeEvent.paymentDetails.accountHolderName})`
                    : activeEvent.paymentBankDetails || 'Maybank 564123456789 (XploreQuest Resources)'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Kemaskini Maklumat Pembayaran (Feature 4C) */}
        <Card role="admin" borderAccent="left" title="Kemaskini Akaun Bank & Pembayaran">
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Bank</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Maybank, CIMB, Bank Islam"
                placeholderTextColor={COLORS.textMuted}
                value={bankName}
                onChangeText={setBankName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Pemegang Akaun</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: XploreQuest Resources"
                placeholderTextColor={COLORS.textMuted}
                value={accountHolderName}
                onChangeText={setAccountHolderName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombor Akaun Bank</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: 564123456789"
                placeholderTextColor={COLORS.textMuted}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nota / Arahan Pembayaran (Pilihan)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Contoh: Sila letakkan nama kumpulan pada rujukan."
                placeholderTextColor={COLORS.textMuted}
                value={paymentNote}
                onChangeText={setPaymentNote}
                multiline
                numberOfLines={2}
                maxLength={500}
              />
            </View>

            <TouchableOpacity
              style={styles.savePaymentBtn}
              onPress={handleSavePaymentDetails}
              disabled={isSavingPayment}
              activeOpacity={0.8}
            >
              {isSavingPayment ? (
                <ActivityIndicator color={COLORS.textLight} size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={COLORS.textLight} />
                  <Text style={styles.savePaymentBtnText}>Simpan Maklumat Pembayaran</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Action Buttons list */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Modul Pengurusan Acara</Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminGeofenceDesigner')}
          >
            <Ionicons name="map-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Rekabentuk Sempadan Geofence (ADM-02)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.primary }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminCheckpointManager')}
          >
            <Ionicons name="flag-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Urus Pos Kawalan & Klu (ADM-03)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminRulesConfig')}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Urus Peraturan & Denda (ADM-04)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.primary }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminPreRegistrations' as any)}
          >
            <Ionicons name="clipboard-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Kelulusan Pendaftaran Web (Pre-Registrations)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminTeamsManager' as any)}
          >
            <Ionicons name="people-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Urus Kumpulan Peserta (Teams)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminLeaderboard')}
          >
            <Ionicons name="stats-chart-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Leaderboard & Keputusan Live (ADM-05)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

        </View>
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
    gap: SPACING.lg,
  },
  eventInfoContainer: {
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  infoRowSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: 2,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    flex: 1,
  },
  eventDetailText: {
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
  },
  boldText: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  credentialsContainer: {
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  credIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  credMeta: {
    flex: 1,
  },
  credLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  credValue: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  unassignedBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  unassignedSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  copyBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  copyBtnDisabled: {
    opacity: 0.4,
  },
  credDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  shareBothBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366', // WhatsApp Brand Green
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    marginTop: SPACING.xs,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  shareBothBtnText: {
    color: COLORS.textLight,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 13,
  },
  formContainer: {
    gap: SPACING.xs,
  },
  inputGroup: {
    marginBottom: SPACING.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    color: COLORS.text,
  },
  savePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.admin.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    marginTop: SPACING.xs,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  savePaymentBtnText: {
    color: COLORS.textLight,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 13,
  },
  actionsContainer: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  actionButtonText: {
    flex: 1,
    color: COLORS.textLight,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 13,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});
