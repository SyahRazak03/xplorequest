/**
 * OrganizerAuthScreen.tsx
 * Field Journal theme — Organizer Login & Sign Up screen.
 *
 * Two-tab UI: "Log Masuk" (Login) | "Daftar" (Sign Up).
 * Only accessible from the Admin role card on RoleSelectScreen.
 * All form logic is mockdata-driven for demo purposes.
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { adminLogin, adminRegister } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OrganizerEntry'>;

type Tab = 'login' | 'signup';

export default function OrganizerAuthScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login } = useApp();

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const tabAnim = useRef(new Animated.Value(0)).current; // 0 = login, 1 = signup

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'login' ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  // ── Login form state ─────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);

  // ── Sign Up form state ───────────────────────────────────────────────────
  const [signupName, setSignupName] = useState('');
  const [signupOrg, setSignupOrg] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupPasswordVisible, setSignupPasswordVisible] = useState(false);
  const [signupConfirmVisible, setSignupConfirmVisible] = useState(false);

  // ── Shared UI state ──────────────────────────────────────────────────────
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginEmail.trim()) {
      Alert.alert('Ralat', 'Sila masukkan e-mel anda.');
      return;
    }
    if (!loginPassword.trim()) {
      Alert.alert('Ralat', 'Sila masukkan kata laluan.');
      return;
    }

    const cleanEmail = loginEmail.toLowerCase().trim();
    setLoading(true);
    try {
      const authRes = await adminLogin(cleanEmail, loginPassword.trim());
      login('admin', {
        id: authRes.uid,
        name: authRes.name || cleanEmail.split('@')[0] || 'Penganjur Acara',
        email: authRes.email || cleanEmail,
        role: 'admin',
      });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err: unknown) {
      Alert.alert(
        'Log Masuk Gagal',
        'Akaun e-mel ini belum didaftarkan atau kata laluan tidak sah.\n\nSila mendaftar akaun baharu di tab "Daftar" terlebih dahulu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signupName.trim() || !signupOrg.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      Alert.alert('Borang Tidak Lengkap', 'Sila isi semua medan yang diperlukan.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      Alert.alert('Kata Laluan Tidak Sepadan', 'Sahkan semula kata laluan anda.');
      return;
    }

    const cleanEmail = signupEmail.toLowerCase().trim();
    setLoading(true);
    try {
      await adminRegister(signupName.trim(), cleanEmail, signupPassword.trim(), signupOrg.trim());
      setLoginEmail(cleanEmail);
      setLoginPassword(signupPassword.trim());
      Alert.alert(
        'Pendaftaran Berjaya! 🎉',
        'Akaun penganjur anda telah didaftarkan. Sila log masuk dengan e-mel dan kata laluan anda.',
        [{ text: 'Log Masuk', onPress: () => switchTab('login') }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftar akaun penganjur.';
      Alert.alert('Pendaftaran Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAutofill = () => {
    if (activeTab === 'login') {
      setLoginEmail(process.env['EXPO_PUBLIC_DEMO_ADMIN_EMAIL'] || 'azman@xplorequest.com');
      setLoginPassword('kunciOrganisasi2026');
    } else {
      setSignupName('Ahmad Zulkifli');
      setSignupOrg('Persatuan Sukan UTM');
      setSignupEmail('ahmad@utm.my');
      setSignupPassword('password123');
      setSignupConfirm('password123');
    }
  };

  // ── Animated indicator position ──────────────────────────────────────────
  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  // ── Input helper ─────────────────────────────────────────────────────────
  const inputRowStyle = (fieldId: string) => [
    styles.inputRow,
    focused === fieldId && styles.inputRowFocused,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Back ──────────────────────────────────────────────────── */}
          <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
            <Text style={styles.backText}>Kembali</Text>
          </TouchableOpacity>

          {/* ── Logo + Heading ──────────────────────────────────────── */}
          <View style={styles.headerBlock}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/XploreQuest_Icon.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.headingTitle}>Portal Penganjur</Text>
            <Text style={styles.headingSubtitle}>
              Log masuk atau buat akaun baharu untuk mengurus acara explorace anda.
            </Text>
          </View>

          {/* ── Tab Switcher ──────────────────────────────────────────── */}
          <View style={styles.tabBar}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'login' && styles.tabLabelActive]}>
                Log Masuk
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('signup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'signup' && styles.tabLabelActive]}>
                Daftar Akaun
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Form Card ─────────────────────────────────────────────── */}
          <View style={styles.formCard}>

            {/* ══ LOGIN FORM ═══════════════════════════════════════════ */}
            {activeTab === 'login' && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>E-mel Penganjur</Text>
                  <View style={[styles.inputShell, focused === 'loginEmail' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'loginEmail' && styles.iconStripFocused]}>
                      <Ionicons name="mail-outline" size={20}
                        color={focused === 'loginEmail' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="contoh@organisasi.com"
                      placeholderTextColor="#BEB5C8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      onFocus={() => setFocused('loginEmail')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Kata Laluan</Text>
                  <View style={[styles.inputShell, focused === 'loginPassword' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'loginPassword' && styles.iconStripFocused]}>
                      <Ionicons name="lock-closed-outline" size={20}
                        color={focused === 'loginPassword' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Masukkan kata laluan"
                      placeholderTextColor="#BEB5C8"
                      secureTextEntry={!loginPasswordVisible}
                      autoCapitalize="none"
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      onFocus={() => setFocused('loginPassword')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity onPress={() => setLoginPasswordVisible(v => !v)} style={styles.eyeBtn}>
                      <Ionicons name={loginPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={20}
                        color={focused === 'loginPassword' ? COLORS.admin.primary : COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Forgot password link */}
                <TouchableOpacity style={styles.forgotRow}>
                  <Text style={styles.forgotText}>Terlupa kata laluan?</Text>
                </TouchableOpacity>

                {/* Login CTA */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnLoading]}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <View style={styles.dashedRing} pointerEvents="none" />
                  <Ionicons
                    name={loading ? 'hourglass-outline' : 'log-in-outline'}
                    size={18}
                    color="#FFF"
                    style={styles.btnIcon}
                  />
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Mengesahkan...' : 'Log Masuk'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ATAU</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Sign up link */}
                <TouchableOpacity style={styles.switchRow} onPress={() => switchTab('signup')}>
                  <Text style={styles.switchText}>
                    Belum ada akaun?{' '}
                    <Text style={styles.switchLink}>Daftar sekarang →</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ══ SIGN UP FORM ════════════════════════════════════════ */}
            {activeTab === 'signup' && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Nama Penuh Penganjur</Text>
                  <View style={[styles.inputShell, focused === 'signupName' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupName' && styles.iconStripFocused]}>
                      <Ionicons name="person-outline" size={20}
                        color={focused === 'signupName' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Nama penuh anda"
                      placeholderTextColor="#BEB5C8"
                      value={signupName}
                      onChangeText={setSignupName}
                      onFocus={() => setFocused('signupName')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Nama Organisasi / Persatuan</Text>
                  <View style={[styles.inputShell, focused === 'signupOrg' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupOrg' && styles.iconStripFocused]}>
                      <Ionicons name="business-outline" size={20}
                        color={focused === 'signupOrg' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Contoh: Persatuan Sukan UTM"
                      placeholderTextColor="#BEB5C8"
                      value={signupOrg}
                      onChangeText={setSignupOrg}
                      onFocus={() => setFocused('signupOrg')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>E-mel Rasmi</Text>
                  <View style={[styles.inputShell, focused === 'signupEmail' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupEmail' && styles.iconStripFocused]}>
                      <Ionicons name="mail-outline" size={20}
                        color={focused === 'signupEmail' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="e-mel@organisasi.com"
                      placeholderTextColor="#BEB5C8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={signupEmail}
                      onChangeText={setSignupEmail}
                      onFocus={() => setFocused('signupEmail')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Kata Laluan</Text>
                  <View style={[styles.inputShell, focused === 'signupPassword' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupPassword' && styles.iconStripFocused]}>
                      <Ionicons name="lock-closed-outline" size={20}
                        color={focused === 'signupPassword' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Min. 8 aksara"
                      placeholderTextColor="#BEB5C8"
                      secureTextEntry={!signupPasswordVisible}
                      autoCapitalize="none"
                      value={signupPassword}
                      onChangeText={setSignupPassword}
                      onFocus={() => setFocused('signupPassword')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity onPress={() => setSignupPasswordVisible(v => !v)} style={styles.eyeBtn}>
                      <Ionicons name={signupPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={20}
                        color={focused === 'signupPassword' ? COLORS.admin.primary : COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Sahkan Kata Laluan</Text>
                  <View style={[styles.inputShell, focused === 'signupConfirm' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupConfirm' && styles.iconStripFocused]}>
                      <Ionicons name="shield-checkmark-outline" size={20}
                        color={focused === 'signupConfirm' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Taip semula kata laluan"
                      placeholderTextColor="#BEB5C8"
                      secureTextEntry={!signupConfirmVisible}
                      autoCapitalize="none"
                      value={signupConfirm}
                      onChangeText={setSignupConfirm}
                      onFocus={() => setFocused('signupConfirm')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity onPress={() => setSignupConfirmVisible(v => !v)} style={styles.eyeBtn}>
                      <Ionicons name={signupConfirmVisible ? 'eye-off-outline' : 'eye-outline'} size={20}
                        color={focused === 'signupConfirm' ? COLORS.admin.primary : COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password strength hint */}
                <View style={styles.strengthRow}>
                  {['Lemah', 'Sederhana', 'Kuat'].map((level, i) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        signupPassword.length > i * 4 && {
                          backgroundColor: i === 0
                            ? COLORS.danger
                            : i === 1
                            ? COLORS.pending
                            : COLORS.success,
                        },
                      ]}
                    />
                  ))}
                  <Text style={styles.strengthLabel}>
                    {signupPassword.length === 0
                      ? ''
                      : signupPassword.length < 5
                      ? 'Lemah'
                      : signupPassword.length < 9
                      ? 'Sederhana'
                      : 'Kuat'}
                  </Text>
                </View>

                {/* Terms notice */}
                <View style={styles.termsRow}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.termsText}>
                    Dengan mendaftar, anda bersetuju dengan{' '}
                    <Text style={styles.termsLink}>Terma & Syarat</Text> XploreQuest.
                  </Text>
                </View>

                {/* Sign Up CTA */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnLoading]}
                  onPress={handleSignUp}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <View style={styles.dashedRing} pointerEvents="none" />
                  <Ionicons
                    name={loading ? 'hourglass-outline' : 'person-add-outline'}
                    size={18}
                    color="#FFF"
                    style={styles.btnIcon}
                  />
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Mendaftar...' : 'Buat Akaun Penganjur'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ATAU</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.switchRow} onPress={() => switchTab('login')}>
                  <Text style={styles.switchText}>
                    Sudah ada akaun?{' '}
                    <Text style={styles.switchLink}>← Log masuk</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Dev Autofill */}
            {__DEV__ && (
              <TouchableOpacity style={styles.autofillBtn} onPress={handleAutofill}>
                <Ionicons name="flash-outline" size={14} color={COLORS.admin.primary} />
                <Text style={styles.autofillText}>Isi Auto Akaun Ujian</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Feature badges ─────────────────────────────────────── */}
          <View style={styles.badgeStrip}>
            {[
              { icon: 'shield-checkmark-outline', label: 'Data Selamat' },
              { icon: 'wifi-outline', label: 'Sokongan Offline' },
              { icon: 'flash-outline', label: 'Masa Nyata' },
            ].map(b => (
              <View key={b.label} style={styles.featureBadge}>
                <Ionicons name={b.icon as any} size={14} color={COLORS.admin.primary} />
                <Text style={styles.featureBadgeText}>{b.label}</Text>
              </View>
            ))}
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
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // ── Back row ──────────────────────────────────────────────────────────────
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  backText: {
    fontSize: TYPOGRAPHY.fontSize.body,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },

  // ── Header block ──────────────────────────────────────────────────────────
  headerBlock: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.admin.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  logoImg: {
    width: 56,
    height: 56,
  },
  headingTitle: {
    fontSize: 26,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    color: COLORS.admin.primary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  headingSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: SPACING.lg,
  },

  // ── Tab switcher ─────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.admin.primaryLight,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
    position: 'relative',
    overflow: 'hidden',
    padding: 3,
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '50%',
    backgroundColor: COLORS.admin.primary,
    borderRadius: RADIUS.full,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.admin.primary,
  },
  tabLabelActive: {
    color: COLORS.textLight,
  },

  // ── Form card ─────────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: SPACING.lg,
    ...SHADOWS.sm,
    marginBottom: SPACING.lg,
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: SPACING.md + 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.admin.primary,
  },

  // Outer shell — white elevated card
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    // Subtle card shadow
    shadowColor: '#2B1A40',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  // Focus state — purple accent border + light tint
  inputShellFocused: {
    borderColor: COLORS.admin.primary,
    borderWidth: 2,
    backgroundColor: '#F8F5FF',
    shadowColor: COLORS.admin.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },

  // Left icon strip — separated section with its own background
  iconStrip: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(43, 26, 64, 0.04)',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  // Focus state for icon strip — purple tint
  iconStripFocused: {
    backgroundColor: COLORS.admin.primaryLight,
    borderRightColor: COLORS.admin.primary,
  },

  // The actual TextInput
  inputText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.body,
    color: COLORS.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    paddingHorizontal: SPACING.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Kept for legacy inputRowStyle helper (no longer used in JSX but prevents TS error)
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputRowFocused: { borderColor: COLORS.admin.primary },
  inputIcon: { marginRight: SPACING.xs },
  input: { flex: 1 },

  eyeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Forgot password ───────────────────────────────────────────────────────
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
    marginTop: -SPACING.xs,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // ── Primary CTA (stamp button) ────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: COLORS.admin.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  primaryBtnLoading: {
    opacity: 0.7,
  },
  dashedRing: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    bottom: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
  },
  btnIcon: {
    marginRight: SPACING.sm,
  },
  primaryBtnText: {
    fontSize: TYPOGRAPHY.fontSize.button,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textLight,
    letterSpacing: 0.3,
  },

  // ── OR divider ────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 1,
  },

  // ── Switch tab link ───────────────────────────────────────────────────────
  switchRow: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  switchText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  switchLink: {
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  // ── Autofill button ───────────────────────────────────────────────────────
  autofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.admin.primaryLight,
    marginTop: SPACING.xs,
  },
  autofillText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    color: COLORS.admin.primary,
  },

  // ── Password strength ─────────────────────────────────────────────────────
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    marginTop: -SPACING.xs,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  strengthLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    width: 52,
    textAlign: 'right',
  },

  // ── Terms notice ──────────────────────────────────────────────────────────
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: SPACING.lg,
  },
  termsText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  termsLink: {
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // ── Feature badges strip ──────────────────────────────────────────────────
  badgeStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.admin.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  featureBadgeText: {
    fontSize: 11,
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
  },
});
