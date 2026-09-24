import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { PrimaryButton, SecondaryButton } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { adminLogin } from '../services/authService';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const route = useRoute<LoginScreenRouteProp>();
  const { role } = route.params || { role: 'participant' };
  const { login, theme, activeEvent } = useApp();

  // Inputs state
  const [eventCode, setEventCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // UI States
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Set default theme for route role if user directly navigated
  useEffect(() => {
    // Already set in setTemporaryRole during role selection card tap,
    // but ensures syncd state.
  }, [role]);

  const handleLogin = async () => {
    if (role === 'participant') {
      if (!eventCode.trim()) {
        Alert.alert('Ralat', 'Sila masukkan Kod Acara.');
        return;
      }
      if (!teamName.trim()) {
        Alert.alert('Ralat', 'Sila masukkan Nama Kumpulan.');
        return;
      }
      // Participant join is handled by CrewSelectCheckpoint-equivalent flow
      // in ParticipantJoinScreen (QR scan → StaggeredStart). LoginScreen for
      // participants is kept for the direct event-code entry path only.
      // Navigate to ParticipantJoin which performs the real auth via QR.
      navigation.navigate('ParticipantJoin');
    } else if (role === 'crew') {
      navigation.navigate('CrewSelectCheckpoint');
    } else if (role === 'admin') {
      if (!adminEmail.trim()) {
        Alert.alert('Ralat', 'Sila masukkan E-mel Admin.');
        return;
      }
      if (!adminPassword.trim()) {
        Alert.alert('Ralat', 'Sila masukkan Kata Laluan.');
        return;
      }
      setLoading(true);
      try {
        const result = await adminLogin(adminEmail.trim(), adminPassword);
        login('admin', {
          id: result.uid,
          name: result.name,
          role: 'admin',
          email: result.email ?? adminEmail,
        });
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Log masuk gagal.';
        Alert.alert('Log Masuk Gagal', msg);
      } finally {
        setLoading(false);
      }
    }
  };

  // Helper values for dynamic content based on role
  const getHeaderDetails = () => {
    switch (role) {
      case 'participant':
        return {
          title: 'Daftar Kumpulan',
          subtitle: 'Sertai cabaran explorace di lokasi dengan kod jemputan khas.',
          icon: 'people',
        };
      case 'crew':
        return {
          title: 'Krew Log Masuk',
          subtitle: 'Pilih pos kawalan bertugas hari ini untuk memulakan tugasan krew.',
          icon: 'qr-code',
        };
      case 'admin':
        return {
          title: 'Organisasi Log Masuk',
          subtitle: 'Panel pengurusan penganjur acara untuk penyelarasan & pengauditan.',
          icon: 'settings',
        };
    }
  };

  const header = getHeaderDetails() || {
    title: 'Log Masuk',
    subtitle: 'Sila masukkan butiran log masuk anda.',
    icon: 'log-in',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('RoleSelect')}
          >
            <Ionicons name="arrow-back-outline" size={24} color={COLORS.text} />
            <Text style={styles.backText}>Kembali</Text>
          </TouchableOpacity>

          {/* Role Header Banner */}
          <View style={styles.headerContainer}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.primaryLight }]}>
              <Ionicons name={header.icon as any} size={36} color={theme.colors.primary} />
            </View>
            <Text style={[styles.title, { color: theme.colors.primary }]}>{header.title}</Text>
            <Text style={styles.subtitle}>{header.subtitle}</Text>
          </View>

          {/* Form Fields Card */}
          <View style={styles.card}>
            {role === 'participant' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Kod Penyertaan Acara</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'eventCode' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="Contoh: XT2026"
                    placeholderTextColor="rgba(28, 46, 36, 0.4)"
                    autoCapitalize="characters"
                    value={eventCode}
                    onChangeText={setEventCode}
                    onFocus={() => setIsFocused('eventCode')}
                    onBlur={() => setIsFocused(null)}
                  />
                  <Text style={styles.inputHint}>Kod penyertaan 6-aksara yang diberikan oleh pihak urus setia.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nama Kumpulan (Team Name)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'teamName' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="Contoh: Pasukan Harimau"
                    placeholderTextColor="rgba(28, 46, 36, 0.4)"
                    value={teamName}
                    onChangeText={setTeamName}
                    onFocus={() => setIsFocused('teamName')}
                    onBlur={() => setIsFocused(null)}
                  />
                </View>
              </>
            )}

            {role === 'crew' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Akses Tugasan Krew Pos Kawalan</Text>
                <Text style={styles.inputHint}>
                  Pilihan pos kawalan dan pengesahan PIN/Marshal ID akan dilengkapkan di skrin seterusnya.
                </Text>
              </View>
            )}

            {role === 'admin' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mel Admin</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'adminEmail' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="Contoh: azman@xplorequest.com"
                    placeholderTextColor="rgba(28, 46, 36, 0.4)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={adminEmail}
                    onChangeText={setAdminEmail}
                    onFocus={() => setIsFocused('adminEmail')}
                    onBlur={() => setIsFocused(null)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Kata Laluan</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'adminPassword' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="Masukkan kata laluan"
                    placeholderTextColor="rgba(28, 46, 36, 0.4)"
                    secureTextEntry
                    autoCapitalize="none"
                    value={adminPassword}
                    onChangeText={setAdminPassword}
                    onFocus={() => setIsFocused('adminPassword')}
                    onBlur={() => setIsFocused(null)}
                  />
                </View>
              </>
            )}

            {/* Login Action Buttons */}
            <View style={styles.buttonSpacing}>
              <PrimaryButton
                label={loading ? 'Memproses...' : (role === 'crew' ? 'Pilih Pos Kawalan' : 'Masuk Dashboard')}
                onPress={handleLogin}
                role={role}
                loading={loading}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },

  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  backText: {
    fontSize: TYPOGRAPHY.fontSize.body,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    ...SHADOWS.sm,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: TYPOGRAPHY.fontSize.body,
    color: COLORS.text,
  },
  inputHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  buttonSpacing: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(92, 110, 100, 0.08)',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
  },
});
