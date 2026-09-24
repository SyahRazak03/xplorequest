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
import { Card, PrimaryButton, Badge, OfflineStatusChip, CustomModalDialog } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { updatePaymentDetailsService, deleteEventService } from '../services/eventService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdminEventDetail'>;

export default function AdminEventDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    user,
    activeEvent,
    setActiveEvent,
    setEvents,
    selectedEventId,
    setSelectedEventId,
    crewPinCode,
    attendanceMarshalId,
    setAttendanceMarshalId,
  } = useApp();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

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
    Alert.alert('Marshal ID Regenerated', `New Marshal ID: ${newId}`);
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

      Alert.alert('Success', 'Organizer bank account details updated.');
    } catch (err: any) {
      // Fallback: update AppContext state locally if backend un-reachable
      setActiveEvent({
        ...activeEvent,
        paymentDetails: newDetails,
      });
      Alert.alert('Updated', 'Payment details updated for this session.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!activeEvent) return;
    setIsDeletingEvent(true);
    try {
      await deleteEventService(activeEvent.id, user?.idToken);
      const targetId = activeEvent.id;
      setEvents((prev) => prev.filter((e) => e.id !== targetId));
      if (selectedEventId === targetId) {
        setSelectedEventId(null);
      }
      setDeleteModalVisible(false);
      Alert.alert(
        'Event Deleted',
        `"${activeEvent.name}" and all associated data have been permanently deleted.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      console.error('Delete event error:', err);
      Alert.alert('Delete Failed', err?.message || 'Unable to delete event. Please try again.');
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    setCopiedField(label);
    Alert.alert('Copied to Clipboard', `${label} (${text}) copied to clipboard.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyBothCredentials = () => {
    const marshalText = attendanceMarshalId
      ? `Marshal ID: ${attendanceMarshalId}`
      : 'Marshal ID: (Not logged in / Unassigned)';
    const text = `*Crew & Marshal Login Credentials*\n📌 Attendance Station: ${marshalText}\n🔑 Crew PIN: ${crewPinCode}`;
    Clipboard.setString(text);
    Alert.alert('Credentials Copied', 'Full credentials copied for sharing via WhatsApp.');
  };

  if (!activeEvent) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No event selected.</Text>
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
          <Text style={styles.headerTitle}>Manage Event</Text>
          <Text style={styles.headerSubtitle}>Specific configuration for selected event</Text>
        </View>
        <OfflineStatusChip />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Selected Event Details Card */}
        <Card role="admin" borderAccent="left" title="Selected Event Details">
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
        <Card role="admin" borderAccent="left" title="Crew & Marshal Login Credentials">
          <View style={styles.credentialsContainer}>
            {/* Attendance Station Marshal ID Row */}
            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="id-card-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.credLabel}>Attendance Station (Marshal ID)</Text>
                  <Badge label="Auto-Gen" state="success" />
                </View>
                <Text style={styles.credValue}>{attendanceMarshalId || 'MSH-8492'}</Text>
                <Text style={styles.unassignedSubtext}>
                  Use this ID for crew login at Attendance Station.
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
                <Text style={styles.credLabel}>General Checkpoint (Crew PIN)</Text>
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
              <Text style={styles.shareBothBtnText}>Copy All Credentials (WhatsApp)</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Web Pre-Registration Information Card (Stage 17) */}
        <Card role="admin" borderAccent="left" title="Web Pre-Registration Configuration">
          <View style={styles.credentialsContainer}>
            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="globe-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <Text style={styles.credLabel}>Web Form Link (URL Slug)</Text>
                <Text style={[styles.credValue, { fontSize: 13 }]} numberOfLines={1}>
                  xplorequest-cab6c.web.app/registration-form/{activeEvent.urlSlug || 'explorace-tasik-titiwangsa-2026'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(`https://xplorequest-cab6c.web.app/registration-form/${activeEvent.urlSlug || 'explorace-tasik-titiwangsa-2026'}`, 'Web Link')}
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
                <Text style={styles.credLabel}>Team Registration Fee</Text>
                <Text style={styles.credValue}>
                  {activeEvent.entryFee !== undefined && activeEvent.entryFee > 0 ? `RM ${activeEvent.entryFee.toFixed(2)}` : 'Free'}
                </Text>
              </View>
            </View>

            <View style={styles.credDivider} />

            <View style={styles.credRow}>
              <View style={styles.credIconWrap}>
                <Ionicons name="card-outline" size={20} color={COLORS.admin.primary} />
              </View>
              <View style={styles.credMeta}>
                <Text style={styles.credLabel}>Bank Account Information</Text>
                <Text style={[styles.credValue, { fontSize: 13 }]}>
                  {activeEvent.paymentDetails?.bankName
                    ? `${activeEvent.paymentDetails.bankName} - ${activeEvent.paymentDetails.accountNumber} (${activeEvent.paymentDetails.accountHolderName})`
                    : activeEvent.paymentBankDetails || 'Maybank 564123456789 (XploreQuest Resources)'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Update Payment Information */}
        <Card role="admin" borderAccent="left" title="Update Bank Account & Payment">
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bank Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Example: Maybank, CIMB, Bank Islam"
                placeholderTextColor={COLORS.textMuted}
                value={bankName}
                onChangeText={setBankName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Example: XploreQuest Resources"
                placeholderTextColor={COLORS.textMuted}
                value={accountHolderName}
                onChangeText={setAccountHolderName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bank Account Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Example: 564123456789"
                placeholderTextColor={COLORS.textMuted}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Notes / Instructions (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Example: Please include team name in payment reference."
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
                  <Text style={styles.savePaymentBtnText}>Save Payment Information</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Action Buttons list */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Event Management Modules</Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminGeofenceDesigner')}
          >
            <Ionicons name="map-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Design Geofence Boundaries</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.primary }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminCheckpointManager')}
          >
            <Ionicons name="flag-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Manage Checkpoints & Clues</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminRulesConfig')}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Manage Rules & Penalties</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.primary }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminPreRegistrations' as any)}
          >
            <Ionicons name="clipboard-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Web Pre-Registration Approval</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminTeamsManager' as any)}
          >
            <Ionicons name="people-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Manage Participant Teams</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.admin.accent }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminLeaderboard')}
          >
            <Ionicons name="stats-chart-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.actionButtonText}>Leaderboard & Live Results</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone: Delete Event Card */}
        <View style={styles.dangerZoneCard}>
          <View style={styles.dangerHeaderRow}>
            <Ionicons name="warning-outline" size={20} color={COLORS.danger} />
            <Text style={styles.dangerTitle}>Danger Zone</Text>
          </View>
          <Text style={styles.dangerDescription}>
            Permanently delete this event and purge all associated checkpoints, participant teams, pre-registrations, leaderboards, and crew credentials.
          </Text>
          <TouchableOpacity
            style={styles.deleteEventBtn}
            activeOpacity={0.8}
            onPress={() => setDeleteModalVisible(true)}
            disabled={isDeletingEvent}
          >
            {isDeletingEvent ? (
              <ActivityIndicator color={COLORS.textLight} size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={COLORS.textLight} />
                <Text style={styles.deleteEventBtnText}>Delete Event</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Event Confirmation Modal */}
      <CustomModalDialog
        visible={deleteModalVisible}
        title="Delete Event?"
        message={
          activeEvent
            ? `Are you sure you want to permanently delete "${activeEvent.name}"?\n\nThis will purge all event details, checkpoints, participant teams, crew access codes, and associated records. This action cannot be undone.`
            : ''
        }
        variant="danger"
        icon="trash-bin-outline"
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setDeleteModalVisible(false),
          },
          {
            text: isDeletingEvent ? 'Deleting...' : 'Delete Event',
            style: 'destructive',
            onPress: confirmDeleteEvent,
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
  dangerZoneCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 80, 107, 0.3)',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  deleteEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  deleteEventBtnText: {
    color: COLORS.textLight,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 13,
  },
});
