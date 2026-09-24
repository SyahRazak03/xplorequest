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
      title: 'Team Leader (Participant)',
      categoryTitle: 'Team Leader',
      description: 'Enter event join code, solve activity clues, scan checkpoint QR codes.',
      icon: 'people-outline',
      themeColor: COLORS.participant.primary,
      accentColor: COLORS.participant.accent,
      bgColor: COLORS.participant.primaryLight,
    },
    {
      id: 'crew' as const,
      title: 'Event Crew (Marshal)',
      categoryTitle: 'Checkpoint Marshal',
      description: 'Verify physical team challenges on-site, upload photo proof, generate dynamic 30s QR codes.',
      icon: 'qr-code-outline',
      themeColor: COLORS.crew.primary,
      accentColor: COLORS.crew.accent,
      bgColor: COLORS.crew.primaryLight,
    },
    {
      id: 'admin' as const,
      title: 'Event Organizer (Admin)',
      categoryTitle: 'Organizer / Admin',
      description: 'Monitor race status, approve team pre-registrations, view live leaderboard, manage checkpoints.',
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
          <Text style={styles.title}>Select Role</Text>
          <Text style={styles.subtitle}>
            Please select your role to proceed with XploreQuest.
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
                  <Text style={[styles.roleCategoryTitle, { color: item.themeColor }]}>
                    {item.categoryTitle}
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
            XploreQuest platform ready for live explorace event management.
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
  roleCategoryTitle: {
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
});
