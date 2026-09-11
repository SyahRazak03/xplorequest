import React, { useState } from 'react';
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
  Switch,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, PrimaryButton, SecondaryButton, Badge, CustomModalDialog } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function AdminRulesConfigScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { rules, setRules } = useApp();

  // Local state for the form inputs
  const [maxRaceTime, setMaxRaceTime] = useState(rules.maxRaceTime);
  const [taskTimeLimit, setTaskTimeLimit] = useState(rules.taskTimeLimit);
  const [latePenaltyMin, setLatePenaltyMin] = useState(rules.latePenaltyMin);
  const [pointPenaltyPts, setPointPenaltyPts] = useState(rules.pointPenaltyPts);
  const [bonusPoints, setBonusPoints] = useState(rules.bonusPoints);

  const [pointsSystemEnabled, setPointsSystemEnabled] = useState(rules.pointsSystemEnabled);
  const [latePenaltyEnabled, setLatePenaltyEnabled] = useState(rules.latePenaltyEnabled);
  const [taskTimeLimitEnabled, setTaskTimeLimitEnabled] = useState(rules.taskTimeLimitEnabled);
  const [pointPenaltyEnabled, setPointPenaltyEnabled] = useState(rules.pointPenaltyEnabled);
  const [bonusPointsEnabled, setBonusPointsEnabled] = useState(rules.bonusPointsEnabled);
  const [modalVisible, setModalVisible] = useState(false);

  const handleSave = () => {
    setRules({
      maxRaceTime,
      taskTimeLimit,
      latePenaltyMin,
      pointPenaltyPts,
      bonusPoints,
      pointsSystemEnabled,
      latePenaltyEnabled,
      taskTimeLimitEnabled,
      pointPenaltyEnabled,
      bonusPointsEnabled,
    });


    setModalVisible(true);
  };

  // Live Scenario Calculation
  // Simulated: 10 minutes late, 1 task skipped
  const calculatedPenaltyMinutes = latePenaltyEnabled ? (10 * latePenaltyMin) : 0;
  const calculatedPenaltyPoints = (pointsSystemEnabled && pointPenaltyEnabled) ? (1 * pointPenaltyPts) : 0;

  const renderStepper = (
    label: string,
    value: number,
    onIncrement: () => void,
    onDecrement: () => void,
    unit: string,
    hint: string
  ) => {
    return (
      <View style={styles.stepperContainer}>
        <View style={styles.stepperInfo}>
          <Text style={styles.stepperLabel}>{label}</Text>
          <Text style={styles.stepperHint}>{hint}</Text>
        </View>

        <View style={styles.stepperControlsWrapper}>
          <TouchableOpacity style={styles.stepperBtn} onPress={onDecrement}>
            <Ionicons name="remove" size={18} color={COLORS.admin.primary} />
          </TouchableOpacity>
          
          <View style={styles.stepperValueContainer}>
            <Text style={styles.stepperValueText}>{value}</Text>
            <Text style={styles.stepperValueUnit}>{unit}</Text>
          </View>

          <TouchableOpacity style={styles.stepperBtn} onPress={onIncrement}>
            <Ionicons name="add" size={18} color={COLORS.admin.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStepperWithToggle = (
    label: string,
    value: number,
    onIncrement: () => void,
    onDecrement: () => void,
    unit: string,
    hint: string,
    enabled: boolean,
    onToggle: (val: boolean) => void
  ) => {
    return (
      <View style={[styles.stepperContainer, !enabled && { opacity: 0.6 }]}>
        <View style={styles.stepperHeaderRow}>
          <View style={[styles.stepperInfo, { flex: 1, marginRight: SPACING.md, marginBottom: 0 }]}>
            <Text style={styles.stepperLabel}>{label}</Text>
            <Text style={styles.stepperHint}>{hint}</Text>
          </View>

          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: COLORS.border, true: COLORS.admin.primary }}
            thumbColor={enabled ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>
        
        {enabled ? (
          <View style={styles.stepperControlsWrapper}>
            <TouchableOpacity style={styles.stepperBtn} onPress={onDecrement}>
              <Ionicons name="remove" size={18} color={COLORS.admin.primary} />
            </TouchableOpacity>
            
            <View style={styles.stepperValueContainer}>
              <Text style={styles.stepperValueText}>{value}</Text>
              <Text style={styles.stepperValueUnit}>{unit}</Text>
            </View>

            <TouchableOpacity style={styles.stepperBtn} onPress={onIncrement}>
              <Ionicons name="add" size={18} color={COLORS.admin.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.disabledLabelWrapper}>
            <Ionicons name="close-circle-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.disabledLabelText}>Peraturan ini ditutup (Tidak Aktif)</Text>
          </View>
        )}
      </View>
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
          <Text style={styles.headerTitle}>Peraturan & Denda Acara</Text>
          <Text style={styles.headerSubtitle}>Tetapan had masa, denda kelewatan & pemarkahan (ADM-04)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Master Point System Toggle */}
        <Card role="admin" borderAccent="left">
          <View style={styles.masterSwitchRow}>
            <View style={styles.masterSwitchTextWrapper}>
              <Text style={styles.masterSwitchTitle}>Sistem Pemarkahan (Point System)</Text>
              <Text style={styles.masterSwitchSubtitle}>
                Hidupkan untuk menggunakan pemarkahan di setiap checkpoint. Matikan untuk meletakkan kedudukan berdasarkan masa semata-mata.
              </Text>
            </View>
            <Switch
              value={pointsSystemEnabled}
              onValueChange={setPointsSystemEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.admin.accent }}
              thumbColor={pointsSystemEnabled ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Main Config Card */}
        <Card role="admin" title="Parameter Had Masa & Pemarkahan" borderAccent="top">
          {/* Max Race Time (Always Required) */}
          {renderStepper(
            'Had Masa Maksimum Acara',
            maxRaceTime,
            () => setMaxRaceTime(prev => Math.min(600, prev + 10)),
            () => setMaxRaceTime(prev => Math.max(30, prev - 10)),
            'Min',
            'Tempoh maksimum had masa keseluruhan sebelum DNF.'
          )}

          <View style={styles.rowDivider} />

          {/* Task Time Limit per CP */}
          {renderStepperWithToggle(
            'Had Masa Tugasan Pos Kawalan',
            taskTimeLimit,
            () => setTaskTimeLimit(prev => Math.min(120, prev + 5)),
            () => setTaskTimeLimit(prev => Math.max(2, prev - 5)),
            'Min',
            'Had masa diperuntukkan bagi menyelesaikan tugasan di CP.',
            taskTimeLimitEnabled,
            setTaskTimeLimitEnabled
          )}

          <View style={styles.rowDivider} />

          {/* Late Penalty */}
          {renderStepperWithToggle(
            'Kadar Denda Lewat (Penalti Masa)',
            latePenaltyMin,
            () => setLatePenaltyMin(prev => Math.min(60, prev + 1)),
            () => setLatePenaltyMin(prev => Math.max(1, prev - 1)),
            'Min',
            'Denda minit tambahan ditambahkan per minit kelewatan penamat.',
            latePenaltyEnabled,
            setLatePenaltyEnabled
          )}

          {pointsSystemEnabled && (
            <>
              <View style={styles.rowDivider} />

              {/* Point Penalty */}
              {renderStepperWithToggle(
                'Penalti Tolak Mata (Skip Tugasan)',
                pointPenaltyPts,
                () => setPointPenaltyPts(prev => Math.min(500, prev + 10)),
                () => setPointPenaltyPts(prev => Math.max(10, prev - 10)),
                'Pts',
                'Mata dipotong bagi kumpulan yang melangkau / melanggar klu.',
                pointPenaltyEnabled,
                setPointPenaltyEnabled
              )}

              <View style={styles.rowDivider} />

              {/* Bonus early points */}
              {renderStepperWithToggle(
                'Mata Bonus Penamat Awal',
                bonusPoints,
                () => setBonusPoints(prev => Math.min(500, prev + 10)),
                () => setBonusPoints(prev => Math.max(10, prev - 10)),
                'Pts',
                'Ganjaran mata tambahan sekiranya menamatkan acara awal.',
                bonusPointsEnabled,
                setBonusPointsEnabled
              )}
            </>
          )}
        </Card>


        {/* Live Simulator Summary Card */}
        <Card role="admin" style={styles.simulatorCard} title="Simulator Senario Pemarkahan Nyata" borderAccent="left">
          <Text style={styles.simulatorDescription}>
            Berikut adalah unjuran simulasi sistem pemarkahan digital berdasarkan parameter peraturan yang anda pilih:
          </Text>

          <View style={styles.scenarioBox}>
            <View style={styles.scenarioHeader}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.admin.primary} />
              <Text style={styles.scenarioHeaderText}>SENARIO ACARA MOCK</Text>
            </View>
            <Text style={styles.scenarioScenarioText}>
              Sebuah pasukan menamatkan acara <Text style={styles.boldText}>lewat 10 minit</Text> dan terpaksa <Text style={styles.boldText}>melangkau 1 tugasan</Text> pos kawalan.
            </Text>
          </View>

          <View style={styles.calculationsContainer}>
            {latePenaltyEnabled && (
              <>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Denda Kelewatan Minit:</Text>
                  <Text style={[styles.calcValue, { color: COLORS.danger }]}>
                    +{calculatedPenaltyMinutes} Minit
                  </Text>
                </View>
                <Text style={styles.calcSubText}>
                  (10 minit lewat × denda {latePenaltyMin} minit tambahan)
                </Text>
              </>
            )}

            {pointsSystemEnabled && pointPenaltyEnabled && (
              <>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Penalti Pemotongan Mata:</Text>
                  <Text style={[styles.calcValue, { color: COLORS.danger }]}>
                    -{calculatedPenaltyPoints} Mata
                  </Text>
                </View>
                <Text style={styles.calcSubText}>
                  (1 tugasan dilangkau × penalti {pointPenaltyPts} mata)
                </Text>
              </>
            )}
          </View>

          <View style={styles.formulaSummaryBanner}>
            <Text style={styles.formulaSummaryText}>
              Pasukan ini akan menerima denda terkumpul sebanyak{' '}
              <Text style={styles.boldText}>+{calculatedPenaltyMinutes} minit</Text> pada masa tamat rasmi
              {pointsSystemEnabled ? (
                <Text>
                  {' '}dan ditolak{' '}
                  <Text style={styles.boldText}>-{calculatedPenaltyPoints} mata</Text> daripada jumlah skor.
                </Text>
              ) : (
                '.'
              )}
            </Text>
          </View>
        </Card>


        {/* Save Button */}
        <PrimaryButton
          label="Simpan Peraturan Acara"
          onPress={handleSave}
          role="admin"
          style={styles.saveBtn}
          icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
        />
      </ScrollView>

      {/* Field Journal Custom Modal Dialog */}
      <CustomModalDialog
        visible={modalVisible}
        variant="success"
        icon="checkmark-circle-outline"
        title="Konfigurasi Disimpan 🎉"
        message="Peraturan, sistem pemarkahan, dan denda masa nyata berjaya dikemaskini."
        buttons={[
          {
            text: 'KEMBALI',
            style: 'default',
            onPress: () => {
              setModalVisible(false);
              navigation.goBack();
            },
          },
        ]}
        onDismiss={() => {
          setModalVisible(false);
          navigation.goBack();
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
  stepperContainer: {
    paddingVertical: SPACING.sm,
  },
  stepperInfo: {
    marginBottom: SPACING.sm,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  stepperHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  stepperControlsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: 6,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  stepperValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepperValueText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  stepperValueUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  simulatorCard: {
    padding: SPACING.md,
  },
  simulatorDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    marginBottom: SPACING.md,
  },
  scenarioBox: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  scenarioHeaderText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    letterSpacing: 0.8,
  },
  scenarioScenarioText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  calculationsContainer: {
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.md,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  calcLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  calcValue: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  calcSubText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  formulaSummaryBanner: {
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  formulaSummaryText: {
    fontSize: 12,
    color: '#C5221F',
    lineHeight: 17,
  },
  saveBtn: {
    marginBottom: SPACING.xl,
  },
  masterSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xs,
    gap: SPACING.md,
  },
  masterSwitchTextWrapper: {
    flex: 1,
  },
  masterSwitchTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  masterSwitchSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  stepperHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  disabledLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
  },
  disabledLabelText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});

