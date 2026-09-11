import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { Card, PrimaryButton, Badge, OfflineStatusChip } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdminEventDetail'>;

export default function AdminEventDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { activeEvent, crewPinCode, theme } = useApp();

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
            <View style={styles.infoRowSecondary}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.eventDetailText}>
                PIN Marshal (Crew):{' '}
                <Text style={[styles.boldText, { color: COLORS.crew.primary }]}>
                  {crewPinCode}
                </Text>
              </Text>
            </View>
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
