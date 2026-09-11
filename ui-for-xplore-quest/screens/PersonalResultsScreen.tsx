import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { Card, Badge, StarBurst } from '../components';

const { width } = Dimensions.get('window');

type PersonalResultsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PersonalResults'>;
type PersonalResultsScreenRouteProp = RouteProp<RootStackParamList, 'PersonalResults'>;

export default function PersonalResultsScreen() {
  const navigation = useNavigation<PersonalResultsScreenNavigationProp>();
  const route = useRoute<PersonalResultsScreenRouteProp>();
  const { logout, rules } = useApp();


  const { finalPoints = 550, elapsedTime = 5080 } = route.params || {};

  const theme = getThemeForRole('participant');

  const formatFullTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    
    let result = '';
    if (h > 0) result += `${h} Jam `;
    if (m > 0) result += `${m} Minit `;
    result += `${s} Saat`;
    return result;
  };

  const handleFinishDemo = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'RoleSelect' }],
    });
  };

  // Math metrics for summary
  const totalCps = 8;
  const avgPaceSecs = Math.round(elapsedTime / totalCps);
  const avgPaceMin = Math.floor(avgPaceSecs / 60);
  const avgPaceSec = avgPaceSecs % 60;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>Keputusan Rasmi Pasukan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Banner Card */}
        <View style={[styles.bannerCard, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, ...theme.shadows.md }]}>
          <Ionicons name="ribbon-outline" size={48} color="#FFD700" style={styles.ribbonIcon} />
          <Text style={styles.bannerTitle}>TAMAT PERLUMBAAN</Text>
          <Text style={styles.bannerSubtitle}>Keputusan rasmi anda direkodkan dalam pangkalan data acara.</Text>
        </View>

        {/* Highlight Stats Block */}
        <View style={styles.statsCard}>
          <View style={styles.rankRow}>
            <Text style={styles.rankLabel}>KEDUDUKAN (SEMENTARA)</Text>
            <Text style={[styles.rankValue, { color: theme.colors.accent }]}>TEMPAT KE-3 / 15</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsGrid}>
            <View style={[styles.statCol, !rules.pointsSystemEnabled && { flex: 1, borderRightWidth: 0, alignItems: 'center' }]}>
              <View style={styles.statHeader}>
                <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.statLabel}>Masa Selesai</Text>
              </View>
              <Text style={styles.statValue}>{formatFullTime(elapsedTime)}</Text>
            </View>

            {rules.pointsSystemEnabled && (
              <View style={styles.statCol}>
                <View style={styles.statHeader}>
                  <Ionicons name="trophy-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.statLabel}>Jumlah Mata</Text>
                </View>
                <Text style={styles.statValue}>{finalPoints} Pts</Text>
              </View>
            )}
          </View>
        </View>


        {/* Analytics Card */}
        <Card role="participant" title="Analitis Prestasi Larian" borderAccent="left">
          <View style={styles.analyticsList}>
            
            <View style={styles.analyticRow}>
              <View style={styles.analyticLabelCol}>
                <Ionicons name="speedometer-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.analyticLabel}>Purata Pace per CP</Text>
              </View>
              <Text style={styles.analyticValue}>
                {avgPaceMin > 0 ? `${avgPaceMin}m ` : ''}{avgPaceSec}s / CP
              </Text>
            </View>

            <View style={styles.analyticRow}>
              <View style={styles.analyticLabelCol}>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                <Text style={styles.analyticLabel}>Kadar Penyelesaian CP</Text>
              </View>
              <Text style={styles.analyticValue}>100% (8/8 CP)</Text>
            </View>

            <View style={styles.analyticRow}>
              <View style={styles.analyticLabelCol}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.analyticLabel}>Status Akuan Krew</Text>
              </View>
              <Badge label="DISAHKAN" state="success" />
            </View>

            {rules.pointsSystemEnabled && (
              <View style={styles.analyticRow}>
                <View style={styles.analyticLabelCol}>
                  <Ionicons name="flame-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.analyticLabel}>Mata CP Akhir</Text>
                </View>
                <Text style={[styles.analyticValue, { color: theme.colors.accent, fontWeight: '700' }]}>+300 Pts</Text>
              </View>
            )}

          </View>
        </Card>

        {/* Congratulations Notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            Sila tunjukkan paparan skrin ini kepada krew pendaftaran di meja urus setia utama untuk menebus medal fizikal dan cenderahati acara kumpulan anda. Terima kasih kerana menyertai!
          </Text>
        </View>

        {/* Exit & Reset Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md }]}
            onPress={handleFinishDemo}
            activeOpacity={0.85}
          >
            <Text style={styles.finishBtnText}>Selesai & Log Keluar</Text>
            <Ionicons name="exit-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  headerBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: TYPOGRAPHY.fontFamily.display,
    letterSpacing: 0.5,
  },
  scrollContainer: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  bannerCard: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ribbonIcon: {
    marginBottom: SPACING.xs,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  rankRow: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  rankLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  rankValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingTop: SPACING.md,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 2,
  },
  analyticsList: {
    gap: SPACING.md,
  },
  analyticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  analyticLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  analyticLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  analyticValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  noticeCard: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  noticeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  finishBtn: {
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
