import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { StarBurst, DashedRoutePath } from '../components';

type RoleSelectScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoleSelect'>;

export default function RoleSelectScreen() {
  const navigation = useNavigation<RoleSelectScreenNavigationProp>();
  const { setTemporaryRole } = useApp();

  const roles = [
    {
      id: 'participant' as const,
      title: 'Ketua Kumpulan (Participant)',
      malayTitle: 'Ketua Pasukan',
      description: 'Daftar kod menyertai explorace, selesaikan klu aktiviti, imbas kod QR checkpoint.',
      icon: 'people-outline',
      themeColor: COLORS.participant.primary,
      accentColor: COLORS.participant.accent,
      bgColor: COLORS.participant.primaryLight,
    },
    {
      id: 'crew' as const,
      title: 'Krew Acara (Marshal)',
      malayTitle: 'Marshal Checkpoint',
      description: 'Sahkan cabaran fizikal kumpulan di lokasi, ambil gambar bukti, jana kod QR rawak 30 saat.',
      icon: 'qr-code-outline',
      themeColor: COLORS.crew.primary,
      accentColor: COLORS.crew.accent,
      bgColor: COLORS.crew.primaryLight,
    },
    {
      id: 'admin' as const,
      title: 'Penganjur Acara (Admin)',
      malayTitle: 'Urus Setia / Admin',
      description: 'Pantau status, luluskan penyertaan pasukan, semak live leaderboard, urus checkpoint.',
      icon: 'settings-outline',
      themeColor: COLORS.admin.primary,
      accentColor: COLORS.admin.accent,
      bgColor: COLORS.admin.primaryLight,
    },
  ];

  const handleRoleSelect = (roleId: 'participant' | 'crew' | 'admin') => {
    // Set theme context instantly for login screen color updates
    setTemporaryRole(roleId);
    if (roleId === 'participant') {
      navigation.navigate('ParticipantJoin');
    } else if (roleId === 'crew') {
      navigation.navigate('CrewSelectCheckpoint');
    } else if (roleId === 'admin') {
      navigation.navigate('OrganizerEntry');
    }
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* Decorative motifs — top corner flourishes */}
        <StarBurst size={36} color={COLORS.decorative.starBurst} opacity={0.5} style={styles.starTopRight} />
        <DashedRoutePath width={160} height={40} color={COLORS.decorative.routePath} opacity={0.25} style={styles.routeTop} />

        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Pilih Peranan</Text>
          <Text style={styles.subtitle}>
            Sila pilih peranan anda untuk memulakan XploreQuest.
          </Text>
        </View>

        {/* Roles Cards Grid */}
        <View style={styles.cardContainer}>
          {roles.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              style={[
                styles.roleCard,
                { borderLeftColor: item.themeColor },
              ]}
              onPress={() => handleRoleSelect(item.id)}
            >
              <View style={styles.cardContent}>
                {/* Left Side: Icon Container */}
                <View
                  style={[
                    styles.iconWrapper,
                    { backgroundColor: item.bgColor },
                  ]}
                >
                  <Ionicons name={item.icon as any} size={28} color={item.themeColor} />
                </View>

                {/* Right Side: Text details */}
                <View style={styles.detailsWrapper}>
                  <Text style={[styles.roleMalayTitle, { color: item.themeColor }]}>
                    {item.malayTitle}
                  </Text>
                  <Text style={styles.roleTitle}>{item.title}</Text>
                  <Text style={styles.roleDesc}>{item.description}</Text>
                </View>
              </View>

              {/* Enter Arrow */}
              <View style={styles.arrowContainer}>
                <Ionicons name="chevron-forward-outline" size={20} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Decorative route path at bottom */}
        <StarBurst size={22} color={COLORS.decorative.starBurst} opacity={0.3} style={styles.starBottom} />

        {/* Info Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Aplikasi XploreQuest sedia untuk pengurusan acara explorace langsung.
          </Text>
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

  scrollContainer: {
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  // Decorative element positions
  starTopRight: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
  },
  routeTop: {
    position: 'absolute',
    top: SPACING.xxl,
    right: -10,
    transform: [{ rotate: '5deg' }],
  },
  starBottom: {
    position: 'absolute',
    bottom: 80,
    left: SPACING.lg,
  },
  header: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    color: COLORS.textDisplay,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 22,
    fontFamily: TYPOGRAPHY.fontFamily.sans,
  },
  cardContainer: {
    flex: 1,
    gap: SPACING.md,
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  roleCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  detailsWrapper: {
    flex: 1,
    paddingRight: SPACING.xs,
  },
  roleMalayTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  roleTitle: {
    fontSize: TYPOGRAPHY.fontSize.bodyLarge,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  roleDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  arrowContainer: {
    alignSelf: 'center',
    paddingLeft: SPACING.xs,
  },
  footer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 16, 46, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FAF9F6', // Field Journal Cream
    borderRadius: RADIUS.lg,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    borderStyle: 'dashed',
    ...SHADOWS.lg,
    position: 'relative',
  },
  modalWashiTape: {
    position: 'absolute',
    top: -8,
    left: 20,
    transform: [{ rotate: '-3deg' }],
    zIndex: 10,
  },
  modalWashiTapeInner: {
    width: 56,
    height: 14,
    backgroundColor: COLORS.decorative.starBurst,
    opacity: 0.85,
    borderRadius: 3,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.participant.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 26,
    color: COLORS.participant.primary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  modalSubText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
  },
  optionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  optionTextWrapper: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
  },
});
