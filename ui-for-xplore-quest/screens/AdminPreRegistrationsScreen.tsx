import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, Badge, OfflineStatusChip, EmptyState, CustomModalDialog } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import {
  PreRegistrationItem,
  subscribeToPreRegistrations,
  approvePreRegistration,
  rejectPreRegistration,
  formatReceiptUrl,
} from '../services/preregistrationService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdminPreRegistrations'>;

export default function AdminPreRegistrationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { activeEvent, user } = useApp();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<PreRegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Receipt Modal State
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [receiptImageLoading, setReceiptImageLoading] = useState<boolean>(true);
  const [receiptImageError, setReceiptImageError] = useState<boolean>(false);

  const handleOpenReceipt = (url: string, storagePath?: string) => {
    const formatted = formatReceiptUrl(url, storagePath) || url;
    setSelectedReceiptUrl(formatted);
    setReceiptImageLoading(true);
    setReceiptImageError(false);
  };

  // Success Approval Modal State (WhatsApp Share)
  const [approvedSuccessData, setApprovedSuccessData] = useState<{
    teamName: string;
    leaderName: string;
    phone: string;
    eventCode: string;
  } | null>(null);

  // Action Loading ID
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEvent) return;
    setLoading(true);

    const unsubscribe = subscribeToPreRegistrations(
      activeEvent.id,
      (newItems) => {
        setItems(newItems);
        setLoading(false);
      },
      (_err) => {
        setLoading(false);
      },
      user?.idToken
    );

    return () => unsubscribe();
  }, [activeEvent, user?.idToken]);

  const filteredItems = items.filter((item) => item.status === activeTab);

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const approvedCount = items.filter((i) => i.status === 'approved').length;
  const rejectedCount = items.filter((i) => i.status === 'rejected').length;

  const handleApprove = async (item: PreRegistrationItem) => {
    if (!activeEvent) return;
    setProcessingId(item.id);

    try {
      await approvePreRegistration(activeEvent.id, item, user?.idToken);
      const code = activeEvent.joinCode || activeEvent.id || 'XT2026';

      setApprovedSuccessData({
        teamName: item.teamName,
        leaderName: item.leaderName,
        phone: item.leaderPhone,
        eventCode: code,
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve registration.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (item: PreRegistrationItem) => {
    if (!activeEvent) return;
    Alert.alert(
      'Reject Registration',
      `Are you sure you want to reject the registration for team "${item.teamName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              await rejectPreRegistration(activeEvent.id, item.id, 'Rejected by organizer after receipt review.', user?.idToken);
              Alert.alert('Updated', `Registration for ${item.teamName} has been rejected.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to reject registration.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const openWhatsApp = (phone: string, teamName: string, eventCode: string) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '60' + cleanPhone.slice(1);
    }

    const message = `Congratulations! Registration for team *${teamName}* for event *${activeEvent?.name || 'XploreQuest'}* has been APPROVED! 🎉\n\n📌 *Event Code*: *${eventCode}*\n📌 *Team Name*: *${teamName}*\n\nPlease download the XploreQuest app, select the *Participant* role, and enter the Event Code and Team Name above to join the event.`;

    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`);
      }
    });
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
          <Text style={styles.headerTitle}>Web Pre-Registration Approval</Text>
          <Text style={styles.headerSubtitle}>{activeEvent.name}</Text>
        </View>
        <OfflineStatusChip />
      </View>

      {/* Segmented Filter Tabs */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.activeTabButton]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'approved' && styles.activeTabButton]}
          onPress={() => setActiveTab('approved')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'approved' && styles.activeTabText]}>
            Approved ({approvedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rejected' && styles.activeTabButton]}
          onPress={() => setActiveTab('rejected')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'rejected' && styles.activeTabText]}>
            Rejected ({rejectedCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.admin.primary} />
            <Text style={styles.loadingText}>Loading web pre-registrations...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title={`No ${activeTab === 'pending' ? 'Pending' : activeTab === 'approved' ? 'Approved' : 'Rejected'} Registrations`}
            description={
              activeTab === 'pending'
                ? 'No new registrations from the web form yet.'
                : 'No records found in this category.'
            }
            icon="document-text-outline"
          />
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} role="admin" borderAccent="left" style={styles.itemCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamNameText}>{item.teamName}</Text>
                  <Text style={styles.leaderText}>Leader: {item.leaderName || '—'}</Text>
                </View>
                <Badge
                  label={
                    item.status === 'approved'
                      ? 'Approved'
                      : item.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending'
                  }
                  state={
                    item.status === 'approved'
                      ? 'success'
                      : item.status === 'rejected'
                      ? 'danger'
                      : 'warning'
                  }
                />
              </View>

              <View style={styles.divider} />

              {/* Meta details */}
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={16} color={COLORS.admin.primary} />
                <Text style={styles.metaText}>Phone: {item.leaderPhone || '—'}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.metaText}>Member Count: {item.memberCount} members</Text>
              </View>

              {item.memberNames && item.memberNames.length > 0 && (
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={16} color={COLORS.textMuted} />
                  <Text style={[styles.metaText, { flex: 1 }]}>
                    Members: {item.memberNames.join(', ')}
                  </Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.metaText}>
                  Submitted At: {new Date(item.submittedAt).toLocaleString('en-US')}
                </Text>
              </View>

              {/* Payment Proof Button */}
              {item.paymentReceiptUrl ? (
                <TouchableOpacity
                  style={styles.receiptButton}
                  onPress={() => handleOpenReceipt(item.paymentReceiptUrl!, item.paymentReceiptStoragePath)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="image-outline" size={18} color={COLORS.admin.primary} />
                  <Text style={styles.receiptButtonText}>View Payment Receipt</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.noReceiptBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.textMuted} />
                  <Text style={styles.noReceiptText}>No payment receipt uploaded</Text>
                </View>
              )}

              {/* Action Buttons */}
              {item.status === 'pending' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleReject(item)}
                    disabled={processingId === item.id}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(item)}
                    disabled={processingId === item.id}
                    activeOpacity={0.8}
                  >
                    {processingId === item.id ? (
                      <ActivityIndicator color={COLORS.textLight} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.textLight} />
                        <Text style={styles.approveBtnText}>Approve & Create Team</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {item.status === 'approved' && (
                <TouchableOpacity
                  style={styles.whatsappShareBtn}
                  onPress={() =>
                    openWhatsApp(
                      item.leaderPhone,
                      item.teamName,
                      activeEvent.joinCode || activeEvent.id || 'XT2026'
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color={COLORS.textLight} />
                  <Text style={styles.whatsappShareBtnText}>Send Event Code via WhatsApp</Text>
                </TouchableOpacity>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Modal View Receipt Image */}
      <Modal visible={!!selectedReceiptUrl} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Receipt</Text>
              <TouchableOpacity onPress={() => setSelectedReceiptUrl(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedReceiptUrl && (
              <View style={styles.receiptImageContainer}>
                {receiptImageLoading && (
                  <View style={styles.receiptLoadingBox}>
                    <ActivityIndicator size="large" color={COLORS.admin.primary} />
                    <Text style={styles.receiptLoadingText}>Loading receipt...</Text>
                  </View>
                )}
                {receiptImageError ? (
                  <View style={styles.receiptErrorBox}>
                    <Ionicons name="alert-circle-outline" size={40} color={COLORS.danger} />
                    <Text style={styles.receiptErrorText}>Failed to load receipt image.</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: selectedReceiptUrl }}
                    style={styles.receiptImage}
                    resizeMode="contain"
                    onLoadStart={() => setReceiptImageLoading(true)}
                    onLoadEnd={() => setReceiptImageLoading(false)}
                    onError={() => {
                      setReceiptImageLoading(false);
                      setReceiptImageError(true);
                    }}
                  />
                )}

                <TouchableOpacity
                  style={styles.openBrowserButton}
                  onPress={() => {
                    if (selectedReceiptUrl) {
                      Linking.openURL(selectedReceiptUrl).catch((err) =>
                        Alert.alert('Error', 'Failed to open receipt link: ' + err.message)
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="open-outline" size={18} color={COLORS.admin.primary} />
                  <Text style={styles.openBrowserButtonText}>Open in Web Browser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Success Approval Dialog */}
      {approvedSuccessData && (
        <CustomModalDialog
          visible={!!approvedSuccessData}
          title="Registration Approved! 🎉"
          message={`Team "${approvedSuccessData.teamName}" has been successfully registered to the team list.\n\nPlease send the Event Code to Team Leader (${approvedSuccessData.leaderName}).`}
          variant="success"
          buttons={[
            {
              text: 'Send via WhatsApp',
              onPress: () => {
                openWhatsApp(
                  approvedSuccessData.phone,
                  approvedSuccessData.teamName,
                  approvedSuccessData.eventCode
                );
                setApprovedSuccessData(null);
              },
            },
            {
              text: 'Close',
              style: 'cancel',
              onPress: () => setApprovedSuccessData(null),
            },
          ]}
          onDismiss={() => setApprovedSuccessData(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.h3,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.textMuted,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  activeTabButton: {
    backgroundColor: COLORS.admin.accent + '20',
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.admin.primary,
    fontWeight: 'bold',
  },
  scrollContainer: {
    padding: SPACING.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.body,
    color: COLORS.textMuted,
  },
  errorText: {
    padding: SPACING.lg,
    color: COLORS.danger,
  },
  itemCard: {
    marginBottom: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  teamNameText: {
    fontSize: TYPOGRAPHY.fontSize.bodyLarge,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  leaderText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.text,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.xs,
    padding: SPACING.xs + 2,
    backgroundColor: COLORS.admin.accent + '15',
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  receiptButtonText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: 'bold',
    color: COLORS.admin.primary,
  },
  noReceiptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  noReceiptText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: COLORS.danger + '15',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  rejectBtnText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: 'bold',
    color: COLORS.danger,
  },
  approveBtn: {
    backgroundColor: COLORS.admin.primary,
  },
  approveBtnText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  whatsappShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    gap: 8,
  },
  whatsappShareBtnText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  receiptModalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.bodyLarge,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  receiptImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250,
  },
  receiptLoadingBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  receiptLoadingText: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.textMuted,
  },
  receiptErrorBox: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  receiptErrorText: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.caption,
    color: COLORS.danger,
    textAlign: 'center',
  },
  receiptImage: {
    width: '100%',
    height: 350,
    borderRadius: RADIUS.md,
  },
  openBrowserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs + 4,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.admin.accent + '15',
    borderRadius: RADIUS.md,
    width: '100%',
  },
  openBrowserButtonText: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: 'bold',
    color: COLORS.admin.primary,
  },
});
