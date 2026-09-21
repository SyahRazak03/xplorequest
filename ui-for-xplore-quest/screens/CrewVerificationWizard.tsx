import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Team, Checkpoint } from '../types';
import { PrimaryButton, SecondaryButton, Card, DynamicQRDisplay, Badge, CustomModalDialog } from '../components';

import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CrewVerificationWizard'>;
type RouteProps = RouteProp<RootStackParamList, 'CrewVerificationWizard'>;

export default function CrewVerificationWizard() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { user, isOffline, setSyncQueueCount, teams: appTeams, checkpoints: appCheckpoints } = useApp();

  const { teamId } = route.params;

  // Retrieve team and checkpoint details
  const team = (appTeams && appTeams.find(t => t.id === teamId)) || {
    id: teamId || 'TEAM-UNKNOWN',
    name: 'Pasukan Peserta',
    status: 'approved' as const,
    memberCount: 1,
    startCheckpointId: '',
    currentCheckpointId: '',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
  };

  const defaultCheckpoint: Checkpoint = {
    id: 'CP-001',
    name: 'Pos Kawalan Krew',
    latitude: 3.1764,
    longitude: 101.7061,
    clueText: '',
    taskDescription: 'Sahkan tugasan fizikal di pos kawalan.',
    scorePoints: 100,
    statusPerTeam: {},
  };
  const checkpoint = (appCheckpoints && user?.checkpointId ? appCheckpoints.find(cp => cp.id === user.checkpointId) : undefined) || appCheckpoints?.[0] || defaultCheckpoint;

  // Wizard state machine
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Physical Verification states
  const [isPhysicallyVerified, setIsPhysicallyVerified] = useState(false);

  // Step 2: Photo Proof states
  const [photoProof, setPhotoProof] = useState<string | null>(null);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current; // For sliding photo transition

  // Step 3: QR Code states
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);

  const handleNextStep = () => {
    if (currentStep === 1 && isPhysicallyVerified) {
      setCurrentStep(2);
    } else if (currentStep === 2 && photoConfirmed) {
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    }
  };

  const handleSnapPhoto = () => {
    // Camera snapshot verified
    setPhotoProof('photo-proof-captured');
    setPhotoConfirmed(false);

    // Run slide-in animation
    slideAnim.setValue(-150);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handleConfirmPhoto = () => {
    setPhotoConfirmed(true);
  };

  const handleRetakePhoto = () => {
    setPhotoProof(null);
    setPhotoConfirmed(false);
  };

  const handleGenerateQR = () => {
    // Create verification payload string
    const payload = `${team.id}-${checkpoint.id}-VERIFIED-${Date.now().toString().slice(-6)}`;
    setQrValue(payload);
    setQrGenerated(true);
  };

  const handleFinishWizard = () => {
    if (isOffline) {
      setSyncQueueCount(prev => prev + 1);
      setOfflineModalVisible(true);
    } else {
      // Pass the completed team ID back to the Dashboard screen
      navigation.navigate({
        name: 'Dashboard',
        params: { completedTeamId: team.id },
        merge: true,
      } as any);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentStep > 1) {
              handlePrevStep();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Verifikasi Kumpulan</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {team.name} • {checkpoint.name}
          </Text>
        </View>
      </View>

      {/* Step Indicator Progress Bar */}
      <View style={styles.indicatorContainer}>
        {[1, 2, 3].map(step => (
          <View key={step} style={styles.stepIndicatorWrapper}>
            <View
              style={[
                styles.stepCircle,
                currentStep === step && styles.activeStepCircle,
                currentStep > step && styles.completedStepCircle,
              ]}
            >
              {currentStep > step ? (
                <Ionicons name="checkmark" size={14} color={COLORS.textLight} />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep === step && styles.activeStepNumber,
                  ]}
                >
                  {step}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                currentStep === step && styles.activeStepLabel,
              ]}
            >
              {step === 1 && 'Sahkan Fizikal'}
              {step === 2 && 'Bukti Foto'}
              {step === 3 && 'Jana QR'}
            </Text>
          </View>
        ))}
      </View>

      {/* Wizard Step Content */}
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {currentStep === 1 && (
          <Card role="crew" borderAccent="top" title="Langkah 1: Pengesahan Fizikal">
            <Text style={styles.instructionText}>
              Sila pastikan ahli kumpulan berada di hadapan anda dan telah menyelesaikan tugasan pos kawalan:
            </Text>

            <View style={styles.taskCard}>
              <Text style={styles.taskLabel}>Tugasan Semasa:</Text>
              <Text style={styles.taskDescription}>{checkpoint.taskDescription}</Text>
              <View style={styles.pointsBadge}>
                <Ionicons name="star" size={12} color="#D97706" />
                <Text style={styles.pointsText}>+{checkpoint.scorePoints} Mata</Text>
              </View>
            </View>

            {/* Custom Checkbox Toggle */}
            <TouchableOpacity
              style={[
                styles.checkboxContainer,
                isPhysicallyVerified && styles.checkboxContainerActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setIsPhysicallyVerified(!isPhysicallyVerified)}
            >
              <Ionicons
                name={isPhysicallyVerified ? 'checkbox' : 'square-outline'}
                size={24}
                color={isPhysicallyVerified ? COLORS.crew.primary : COLORS.textMuted}
              />
              <Text style={styles.checkboxText}>
                Saya sahkan pasukan ini telah menyelesaikan tugasan secara fizikal di hadapan saya.
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {currentStep === 2 && (
          <Card role="crew" borderAccent="top" title="Langkah 2: Tangkap Gambar Bukti">
            <Text style={styles.instructionText}>
              Tangkap sekurang-kurangnya satu gambar bukti tugasan atau foto berkumpulan untuk audit penganjur.
            </Text>

            {!photoProof ? (
              <TouchableOpacity
                style={styles.cameraPlaceholderButton}
                activeOpacity={0.8}
                onPress={handleSnapPhoto}
              >
                <View style={styles.cameraIconCircle}>
                  <Ionicons name="camera" size={32} color={COLORS.crew.primary} />
                </View>
                <Text style={styles.cameraButtonText}>Ambil Gambar Bukti</Text>
                <Text style={styles.cameraButtonSubtext}>Tekan untuk merakam bukti lokasi</Text>
              </TouchableOpacity>
            ) : (
              <Animated.View
                style={[
                  styles.photoPreviewCard,
                  { transform: [{ translateY: slideAnim }] },
                ]}
              >
                <Image
                  source={require('../assets/team_photo_proof.png')}
                  style={styles.photoProofImage}
                  resizeMode="cover"
                />

                {!photoConfirmed ? (
                  <View style={styles.photoActionOverlay}>
                    <Text style={styles.confirmPromptText}>Adakah foto ini jelas?</Text>
                    <View style={styles.overlayButtonsRow}>
                      <TouchableOpacity
                        style={[styles.overlayBtn, styles.overlayBtnRetake]}
                        onPress={handleRetakePhoto}
                      >
                        <Ionicons name="close" size={16} color={COLORS.danger} />
                        <Text style={styles.overlayBtnRetakeText}>Ambil Semula</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.overlayBtn, styles.overlayBtnConfirm]}
                        onPress={handleConfirmPhoto}
                      >
                        <Ionicons name="checkmark" size={16} color={COLORS.textLight} />
                        <Text style={styles.overlayBtnConfirmText}>Sahkan Foto</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoConfirmedOverlay}>
                    <Badge label="FOTO DISAHKAN" state="success" />
                    <TouchableOpacity
                      style={styles.changePhotoTextButton}
                      onPress={handleRetakePhoto}
                    >
                      <Text style={styles.changePhotoText}>Tukar Foto</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            )}
          </Card>
        )}

        {currentStep === 3 && (
          <Card role="crew" borderAccent="top" title="Langkah 3: Pelepasan Kod QR">
            <Text style={styles.instructionText}>
              Jana kod QR pelepasan untuk diimbas oleh pasukan. Kod QR ini dinamik dan akan tamat tempoh dalam masa 30 saat untuk keselamatan.
            </Text>

            {!qrGenerated ? (
              <TouchableOpacity
                style={styles.qrGenerateButton}
                activeOpacity={0.8}
                onPress={handleGenerateQR}
              >
                <View style={styles.qrIconCircle}>
                  <Ionicons name="qr-code-outline" size={36} color={COLORS.crew.primary} />
                </View>
                <Text style={styles.qrButtonText}>Jana QR Kod Pelepasan</Text>
                <Text style={styles.qrButtonSubtext}>Kod tamat tempoh dalam 30 saat</Text>
              </TouchableOpacity>
            ) : (
              <DynamicQRDisplay
                value={qrValue}
                duration={30}
                onRefresh={handleGenerateQR}
              />
            )}
          </Card>
        )}
      </ScrollView>

      {/* Footer Navigation Buttons */}
      <View style={styles.footer}>
        {currentStep === 3 ? (
          <PrimaryButton
            label="Selesai & Hantar (Finish)"
            onPress={handleFinishWizard}
            role="crew"
            disabled={!qrGenerated}
            icon={<Ionicons name="checkmark-done" size={18} color={COLORS.textLight} />}
            style={styles.navButton}
          />
        ) : (
          <PrimaryButton
            label="Seterusnya"
            onPress={handleNextStep}
            role="crew"
            disabled={
              (currentStep === 1 && !isPhysicallyVerified) ||
              (currentStep === 2 && !photoConfirmed)
            }
            icon={<Ionicons name="arrow-forward" size={18} color={COLORS.textLight} />}
            style={styles.navButton}
          />
        )}
      </View>

      {/* Custom Field Journal Offline Success Modal */}
      <CustomModalDialog
        visible={offlineModalVisible}
        variant="warning"
        icon="cloud-offline-outline"
        title="Mod Offline Aktif 📡"
        message="Imbasan berjaya disimpan secara tempatan di SQLite Queue. Data akan dihantar secara automatik sebaik sahaja rangkaian internet pulih."
        buttons={[
          {
            text: 'SELESAI',
            style: 'default',
            onPress: () => {
              navigation.navigate({
                name: 'Dashboard',
                params: { completedTeamId: team.id },
                merge: true,
              } as any);
            },
          },
        ]}
        onDismiss={() => {
          setOfflineModalVisible(false);
          navigation.navigate({
            name: 'Dashboard',
            params: { completedTeamId: team.id },
            merge: true,
          } as any);
        }}
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
    padding: SPACING.md,
    backgroundColor: COLORS.card,
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
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stepIndicatorWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeStepCircle: {
    backgroundColor: COLORS.crew.primaryLight,
    borderColor: COLORS.crew.primary,
  },
  completedStepCircle: {
    backgroundColor: COLORS.crew.primary,
    borderColor: COLORS.crew.primary,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
  },
  activeStepNumber: {
    color: COLORS.crew.primary,
  },
  stepLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activeStepLabel: {
    color: COLORS.crew.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  contentContainer: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  taskCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  taskLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9DB',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
    gap: 4,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#D97706',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    gap: SPACING.sm,
  },
  checkboxContainerActive: {
    borderColor: COLORS.crew.primary,
    backgroundColor: COLORS.crew.primaryLight,
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  cameraPlaceholderButton: {
    borderWidth: 2,
    borderColor: COLORS.crew.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.crew.primaryLight,
  },
  cameraIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cameraButtonText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.crew.primary,
  },
  cameraButtonSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  photoPreviewCard: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    ...SHADOWS.sm,
    height: 240,
    position: 'relative',
  },
  photoProofImage: {
    width: '100%',
    height: '100%',
  },
  photoActionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28, 46, 36, 0.85)',
    padding: SPACING.md,
    alignItems: 'center',
  },
  confirmPromptText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },
  overlayButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  overlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  overlayBtnRetake: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  overlayBtnRetakeText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  overlayBtnConfirm: {
    backgroundColor: COLORS.crew.primary,
  },
  overlayBtnConfirmText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  photoConfirmedOverlay: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changePhotoTextButton: {
    backgroundColor: 'rgba(28, 46, 36, 0.65)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
  },
  changePhotoText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  qrGenerateButton: {
    borderWidth: 1.5,
    borderColor: COLORS.crew.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    ...SHADOWS.sm,
  },
  qrIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.crew.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.crew.primary,
  },
  qrButtonSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  navButton: {
    width: '100%',
  },
});
