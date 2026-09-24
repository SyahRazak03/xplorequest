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
import { adminLogin, adminRegister, resendVerificationEmail, resetPassword } from '../services/authService';
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
  const handleResendVerification = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      Alert.alert('Email & Password Required', 'Please enter your registered email and password to resend the verification email.');
      return;
    }
    setLoading(true);
    try {
      await resendVerificationEmail(loginEmail.trim().toLowerCase(), loginPassword.trim());
      Alert.alert('Verification Email Sent 📧', 'A new verification email has been sent to your inbox. Please check your spam folder if you do not see it.');
    } catch (err: any) {
      Alert.alert('Resend Failed', err.message || 'Could not resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your registered organizer email in the Email field, then tap "Forgot password?".'
      );
      return;
    }

    const cleanEmail = loginEmail.toLowerCase().trim();
    setLoading(true);
    try {
      await resetPassword(cleanEmail);
      Alert.alert(
        'Password Reset Email Sent 🔑',
        `A password reset link has been sent to ${cleanEmail}.\n\nPlease check your inbox and follow the instructions to reset your password.`
      );
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Could not send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your organizer email address.');
      return;
    }
    if (!loginPassword.trim()) {
      Alert.alert('Password Required', 'Please enter your password.');
      return;
    }

    const cleanEmail = loginEmail.toLowerCase().trim();
    setLoading(true);
    try {
      const authRes = await adminLogin(cleanEmail, loginPassword.trim());
      login('admin', {
        id: authRes.uid,
        name: authRes.name || cleanEmail.split('@')[0] || 'Event Organizer',
        email: authRes.email || cleanEmail,
        role: 'admin',
      });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      if (msg.includes('Email not verified')) {
        Alert.alert(
          'Email Verification Required 📧',
          'Your email address has not been verified yet. Please check your inbox and click the verification link before logging in.',
          [
            { text: 'Resend Email', onPress: handleResendVerification },
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signupName.trim() || !signupOrg.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      Alert.alert('Password Mismatch', 'Please confirm your password again.');
      return;
    }

    const cleanEmail = signupEmail.toLowerCase().trim();
    setLoading(true);
    try {
      await adminRegister(signupName.trim(), cleanEmail, signupPassword.trim(), signupOrg.trim());
      setLoginEmail(cleanEmail);
      setLoginPassword(signupPassword.trim());
      Alert.alert(
        'Registration Successful! 🎉',
        'Your organizer account has been created. A verification link has been sent to ' + cleanEmail + '.\n\nPlease check your email inbox and click the link to verify your account before logging in.',
        [{ text: 'Proceed to Login', onPress: () => switchTab('login') }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register organizer account.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
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
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.reset({ index: 0, routes: [{ name: 'RoleSelect' }] });
              }
            }}
          >
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
            <Text style={styles.backText}>Back</Text>
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
            <Text style={styles.headingTitle}>Organizer Portal</Text>
            <Text style={styles.headingSubtitle}>
              Log in or create a new account to manage your explorace events.
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
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => switchTab('signup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'signup' && styles.tabLabelActive]}>
                Register Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Form Card ─────────────────────────────────────────────── */}
          <View style={styles.formCard}>

            {/* ══ LOGIN FORM ═══════════════════════════════════════════ */}
            {activeTab === 'login' && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Organizer Email</Text>
                  <View style={[styles.inputShell, focused === 'loginEmail' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'loginEmail' && styles.iconStripFocused]}>
                      <Ionicons name="mail-outline" size={20}
                        color={focused === 'loginEmail' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="example@organization.com"
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
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[styles.inputShell, focused === 'loginPassword' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'loginPassword' && styles.iconStripFocused]}>
                      <Ionicons name="lock-closed-outline" size={20}
                        color={focused === 'loginPassword' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Enter password"
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
                <TouchableOpacity style={styles.forgotRow} onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
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
                    {loading ? 'Authenticating...' : 'Log In'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Sign up link */}
                <TouchableOpacity style={styles.switchRow} onPress={() => switchTab('signup')}>
                  <Text style={styles.switchText}>
                    Don't have an account?{' '}
                    <Text style={styles.switchLink}>Register now →</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ══ SIGN UP FORM ════════════════════════════════════════ */}
            {activeTab === 'signup' && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name of Organizer</Text>
                  <View style={[styles.inputShell, focused === 'signupName' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupName' && styles.iconStripFocused]}>
                      <Ionicons name="person-outline" size={20}
                        color={focused === 'signupName' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Your full name"
                      placeholderTextColor="#BEB5C8"
                      value={signupName}
                      onChangeText={setSignupName}
                      onFocus={() => setFocused('signupName')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Organization / Association Name</Text>
                  <View style={[styles.inputShell, focused === 'signupOrg' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupOrg' && styles.iconStripFocused]}>
                      <Ionicons name="business-outline" size={20}
                        color={focused === 'signupOrg' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Example: UTM Sports Association"
                      placeholderTextColor="#BEB5C8"
                      value={signupOrg}
                      onChangeText={setSignupOrg}
                      onFocus={() => setFocused('signupOrg')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Official Email</Text>
                  <View style={[styles.inputShell, focused === 'signupEmail' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupEmail' && styles.iconStripFocused]}>
                      <Ionicons name="mail-outline" size={20}
                        color={focused === 'signupEmail' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="email@organization.com"
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
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[styles.inputShell, focused === 'signupPassword' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupPassword' && styles.iconStripFocused]}>
                      <Ionicons name="lock-closed-outline" size={20}
                        color={focused === 'signupPassword' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Min. 8 characters"
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
                  <Text style={styles.fieldLabel}>Confirm Password</Text>
                  <View style={[styles.inputShell, focused === 'signupConfirm' && styles.inputShellFocused]}>
                    <View style={[styles.iconStrip, focused === 'signupConfirm' && styles.iconStripFocused]}>
                      <Ionicons name="shield-checkmark-outline" size={20}
                        color={focused === 'signupConfirm' ? COLORS.admin.primary : COLORS.textMuted} />
                    </View>
                    <TextInput
                      style={styles.inputText}
                      placeholder="Retype password"
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
                  {['Weak', 'Medium', 'Strong'].map((level, i) => (
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
                      ? 'Weak'
                      : signupPassword.length < 9
                      ? 'Medium'
                      : 'Strong'}
                  </Text>
                </View>

                {/* Terms notice */}
                <View style={styles.termsRow}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.termsText}>
                    By registering, you agree to the{' '}
                    <Text style={styles.termsLink}>Terms & Conditions</Text> of XploreQuest.
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
                    {loading ? 'Registering...' : 'Create Organizer Account'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.switchRow} onPress={() => switchTab('login')}>
                  <Text style={styles.switchText}>
                    Already have an account?{' '}
                    <Text style={styles.switchLink}>← Log in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </View>

          {/* ── Feature badges ─────────────────────────────────────── */}
          <View style={styles.badgeStrip}>
            {[
              { icon: 'shield-checkmark-outline', label: 'Secure Data' },
              { icon: 'wifi-outline', label: 'Offline Support' },
              { icon: 'flash-outline', label: 'Real-Time' },
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
