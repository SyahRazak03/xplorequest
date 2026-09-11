import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { getThemeForRole, UserRole, COLORS } from '../theme';
import {
  PrimaryButton,
  SecondaryButton,
  Card,
  Badge,
  ProgressBar,
  Avatar,
  SectionHeader,
} from './index';

export const DesignSystemDemo: React.FC = () => {
  const [activeRole, setActiveRole] = useState<UserRole>('participant');
  const [btnLoading, setBtnLoading] = useState(false);
  const [progressVal, setProgressVal] = useState(60);

  const theme = getThemeForRole(activeRole);
  const { colors, spacing, radius, typography } = theme;

  const triggerLoadingDemo = () => {
    setBtnLoading(true);
    setTimeout(() => {
      setBtnLoading(false);
      Alert.alert(
        'Simulasi Selesai',
        'Tindakan berjaya diproses bagi peranan: ' + activeRole.toUpperCase()
      );
    }, 2000);
  };

  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={activeRole === 'admin' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.primaryDark}
      />

      {/* Malaysian Client Demo Branding Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.appTitle, { color: colors.textLight }]}>
            XploreQuest 🗺️
          </Text>
          <Text style={[styles.appSubtitle, { color: colors.primaryLight }]}>
            Dapo Awoknyee Resources (KL Event Crew) Demo
          </Text>
        </View>
        <Avatar initials={activeRole === 'participant' ? 'TL' : activeRole === 'crew' ? 'MC' : 'AD'} role={activeRole} size="md" />
      </View>

      {/* Role Switcher Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        {(['participant', 'crew', 'admin'] as UserRole[]).map((role) => {
          const isActive = activeRole === role;
          const roleTheme = getThemeForRole(role);
          
          let roleLabel = 'Peserta';
          if (role === 'crew') roleLabel = 'Krew (Marshal)';
          if (role === 'admin') roleLabel = 'Admin';

          return (
            <TouchableOpacity
              key={role}
              style={[
                styles.tab,
                isActive && {
                  borderBottomColor: roleTheme.colors.primary,
                  borderBottomWidth: 3,
                },
              ]}
              onPress={() => handleRoleChange(role)}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive ? roleTheme.colors.primary : COLORS.textMuted,
                    fontWeight: isActive ? typography.fontWeight.bold : typography.fontWeight.medium,
                  },
                ]}
              >
                {roleLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.md }]}>
        
        {/* Role Palette Status Card */}
        <Card
          role={activeRole}
          borderAccent="left"
          title="Perincian Mod Demo"
          subtitle={`Setem warna aktif bagi peranan: ${activeRole.toUpperCase()}`}
          style={styles.cardSpacing}
        >
          <Text style={[styles.descriptionText, { color: colors.text }]}>
            {activeRole === 'participant' &&
              'Mod Peserta menggunakan rona Hijau Hutan (Forest Green) melambangkan alam semula jadi & eksplorasi fizikal. Butang tindakan utama juga diselaraskan.'}
            {activeRole === 'crew' &&
              'Mod Krew Lapangan (Field Marshal) menggunakan rona Jingga Laluan (Trail Orange) berimpak tinggi untuk keterlihatan tinggi di lapangan hutan/taman.'}
            {activeRole === 'admin' &&
              'Mod Organisasi (Admin) menggunakan rona Biru Gelap (Navy Slate) untuk memberikan identiti korporat, panel pengurusan, dan kawalan sekuriti.'}
          </Text>

          <View style={styles.colorPillContainer}>
            <View style={[styles.colorPill, { backgroundColor: colors.primary }]}>
              <Text style={styles.colorPillText}>Primary</Text>
            </View>
            <View style={[styles.colorPill, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.colorPillText, { color: colors.primary }]}>Light</Text>
            </View>
            <View style={[styles.colorPill, { backgroundColor: colors.accent }]}>
              <Text style={styles.colorPillText}>Accent</Text>
            </View>
          </View>
        </Card>

        {/* Section 1: Typography Scale */}
        <SectionHeader
          title="1. Skala Tipografi"
          subtitle="Gaya tulisan standard sistem navigasi"
          role={activeRole}
        />
        <Card role={activeRole} style={styles.cardSpacing}>
          <Text style={[styles.typoH1, { fontWeight: typography.fontWeight.bold, color: colors.text }]}>Heading 1 (28px)</Text>
          <Text style={[styles.typoH2, { fontWeight: typography.fontWeight.semiBold, color: colors.text, marginTop: spacing.sm }]}>Heading 2 (22px)</Text>
          <Text style={[styles.typoH3, { fontWeight: typography.fontWeight.medium, color: colors.text, marginTop: spacing.sm }]}>Heading 3 (18px)</Text>
          <Text style={[styles.typoBodyLarge, { fontWeight: typography.fontWeight.regular, color: colors.text, marginTop: spacing.sm }]}>Body Large (16px) untuk teks utama pembacaan.</Text>
          <Text style={[styles.typoBody, { fontWeight: typography.fontWeight.regular, color: colors.textMuted, marginTop: spacing.xs }]}>Body Regular (14px) untuk teks perincian am.</Text>
          <Text style={[styles.typoCaption, { fontWeight: typography.fontWeight.regular, color: colors.textMuted, marginTop: spacing.xs }]}>Caption Text (12px) bagi metadata & label kecil.</Text>
        </Card>

        {/* Section 2: Atomic Buttons */}
        <SectionHeader
          title="2. Butang & Interaksi"
          subtitle="Utama, Sekunder, Muatan & Batal"
          role={activeRole}
        />
        <Card role={activeRole} style={styles.cardSpacing}>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Butang Utama (Primary Button)</Text>
          <PrimaryButton
            label="Simpan Maklumat / Scan QR"
            role={activeRole}
            onPress={() => Alert.alert('Berjaya', 'Butang Utama Ditekan')}
            style={{ marginBottom: spacing.md }}
          />

          <Text style={[styles.sectionSubtitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Butang Sekunder (Secondary Button)</Text>
          <SecondaryButton
            label="Langkau Tugasan (Skip Checkpoint)"
            role={activeRole}
            onPress={() => Alert.alert('Langkau', 'Bypass geofence diaktifkan sementara')}
            style={{ marginBottom: spacing.md }}
          />

          <Text style={[styles.sectionSubtitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Mod Garis Luar (Outline Variant)</Text>
          <PrimaryButton
            label="Kembali ke Peta"
            role={activeRole}
            variant="outline"
            onPress={() => Alert.alert('Peta', 'Membuka peta laluan')}
            style={{ marginBottom: spacing.md }}
          />

          <Text style={[styles.sectionSubtitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Butang Muatan Dinamik (Loading & Disabled State)</Text>
          <View style={styles.buttonRow}>
            <PrimaryButton
              label="Hantar Bukti Foto"
              role={activeRole}
              loading={btnLoading}
              onPress={triggerLoadingDemo}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <PrimaryButton
              label="Terkunci"
              role={activeRole}
              disabled={true}
              onPress={() => {}}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Section 3: Badges (States & Checkpoints) */}
        <SectionHeader
          title="3. Lencana Status (Badges)"
          subtitle="Mengikut lojik skip dan pengesahan marshal"
          role={activeRole}
        />
        <Card role={activeRole} style={styles.cardSpacing}>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Lencana Urus Setia</Text>
          <View style={styles.badgeRow}>
            <Badge label="SELESAI" state="success" style={styles.badgeMargin} />
            <Badge label="TERTANGGUH" state="pending" style={styles.badgeMargin} />
            <Badge label="AMARAN" state="warning" style={styles.badgeMargin} />
            <Badge label="GAGAL / DNF" state="danger" style={styles.badgeMargin} />
            <Badge label="INFO" state="info" />
          </View>

          <Text style={[styles.sectionSubtitle, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm }]}>Penggunaan Contoh di CP (Checkpoints)</Text>
          <View style={[styles.checkpointItem, { borderColor: colors.border }]}>
            <Text style={[styles.checkpointText, { color: colors.text }]}>CP1: Tasik Titiwangsa (Kayuh Bot)</Text>
            <Badge label="SELESAI ✅" state="success" size="sm" />
          </View>
          <View style={[styles.checkpointItem, { borderColor: colors.border }]}>
            <Text style={[styles.checkpointText, { color: colors.text }]}>CP2: Bulatan Rimba (Ikatan Tali)</Text>
            <Badge label="TERTANGGUH ⚠️" state="pending" size="sm" />
          </View>
          <View style={[styles.checkpointItem, { borderColor: colors.border }]}>
            <Text style={[styles.checkpointText, { color: colors.text }]}>CP3: Larian Denai (Tamat Tempoh)</Text>
            <Badge label="LEBIH HAD ⏳" state="danger" size="sm" />
          </View>
        </Card>

        {/* Section 4: Progress Indicator */}
        <SectionHeader
          title="4. Penunjuk Kemajuan"
          subtitle="Digunakan untuk memantau status explorace semasa"
          role={activeRole}
        />
        <Card role={activeRole} style={styles.cardSpacing}>
          <ProgressBar
            progress={progressVal}
            role={activeRole}
            showLabel={true}
            labelText="Kemajuan Keseluruhan Race"
            style={{ marginBottom: spacing.md }}
          />

          <View style={styles.buttonRow}>
            <SecondaryButton
              label="Kurang Kemajuan (-20%)"
              role={activeRole}
              onPress={() => setProgressVal(Math.max(progressVal - 20, 0))}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <SecondaryButton
              label="Tambah Kemajuan (+20%)"
              role={activeRole}
              onPress={() => setProgressVal(Math.min(progressVal + 20, 100))}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Section 5: Avatars & Profiles */}
        <SectionHeader
          title="5. Profil & Avatar"
          subtitle="Identiti dengan penanda sempadan peranan"
          role={activeRole}
        />
        <Card role={activeRole} style={styles.cardSpacing}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              <Avatar initials="TL" role="participant" size="sm" />
              <Text style={[styles.avatarLabel, { color: colors.textMuted }]}>Participant (SM)</Text>
            </View>
            <View style={styles.avatarContainer}>
              <Avatar initials="HN" role="crew" size="md" />
              <Text style={[styles.avatarLabel, { color: colors.textMuted }]}>Crew (MD)</Text>
            </View>
            <View style={styles.avatarContainer}>
              <Avatar initials="AZ" role="admin" size="lg" />
              <Text style={[styles.avatarLabel, { color: colors.textMuted }]}>Admin (LG)</Text>
            </View>
            <View style={styles.avatarContainer}>
              <Avatar initials="DAR" role={activeRole} size="xl" />
              <Text style={[styles.avatarLabel, { color: colors.textMuted }]}>Aktif (XL)</Text>
            </View>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  tab: {
    paddingVertical: 14,
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  cardSpacing: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  colorPillContainer: {
    flexDirection: 'row',
    marginTop: 12,
  },
  colorPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  typoH1: {
    fontSize: 28,
  },
  typoH2: {
    fontSize: 22,
  },
  typoH3: {
    fontSize: 18,
  },
  typoBodyLarge: {
    fontSize: 16,
    lineHeight: 22,
  },
  typoBody: {
    fontSize: 14,
    lineHeight: 18,
  },
  typoCaption: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  badgeMargin: {
    marginRight: 8,
    marginBottom: 8,
  },
  checkpointItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  checkpointText: {
    fontSize: 13,
    fontWeight: '500',
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    width: '100%',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarLabel: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '500',
  },
});
export default DesignSystemDemo;
