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
import { PrimaryButton } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import { adminLogin } from '../services/authService';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const route = useRoute<LoginScreenRouteProp>();
  const { role } = route.params || { role: 'participant' };
  const { login, theme } = useApp();

  // Inputs state
  const [eventCode, setEventCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // UI States
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Synchronize role state
  }, [role]);

  const handleLogin = async () => {
    if (role === 'participant') {
      if (!eventCode.trim()) {
        Alert.alert('Error', 'Please enter Event Join Code.');
        return;
      }
      if (!teamName.trim()) {
        Alert.alert('Error', 'Please enter Team Name.');
        return;
      }
      navigation.navigate('ParticipantJoin');
    } else if (role === 'crew') {
      navigation.navigate('CrewSelectCheckpoint');
    } else if (role === 'admin') {
      if (!adminEmail.trim()) {
        Alert.alert('Error', 'Please enter Admin Email.');
        return;
      }
      if (!adminPassword.trim()) {
        Alert.alert('Error', 'Please enter Password.');
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
        const msg = err instanceof Error ? err.message : 'Sign in failed.';
        Alert.alert('Sign In Failed', msg);
      } finally {
        setLoading(false);
      }
    }
  };

  const getHeaderDetails = () => {
    switch (role) {
      case 'participant':
        return {
          title: 'Team Registration',
          subtitle: 'Join on-site explorace challenges with your event invitation code.',
          icon: 'people',
        };
      case 'crew':
        return {
          title: 'Crew Sign In',
          subtitle: 'Select your assigned checkpoint station for today to start duties.',
          icon: 'qr-code',
        };
      case 'admin':
        return {
          title: 'Organizer Sign In',
          subtitle: 'Organizer management portal for race coordination and auditing.',
          icon: 'settings',
        };
    }
  };

  const header = getHeaderDetails() || {
    title: 'Sign In',
    subtitle: 'Please enter your login details.',
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
            <Text style={styles.backText}>Back</Text>
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
                  <Text style={styles.label}>Event Join Code</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'eventCode' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="e.g., XT2026"
                    placeholderTextColor="rgba(28, 46, 36, 0.4)"
                    autoCapitalize="characters"
                    value={eventCode}
                    onChangeText={setEventCode}
                    onFocus={() => setIsFocused('eventCode')}
                    onBlur={() => setIsFocused(null)}
                  />
                  <Text style={styles.inputHint}>6-character event code provided by the organizer.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Team Name</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'teamName' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="e.g., Tiger Squad"
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
                <Text style={styles.label}>Checkpoint Crew Access</Text>
                <Text style={styles.inputHint}>
                  Checkpoint station selection and PIN/Marshal ID verification will be completed on the next screen.
                </Text>
              </View>
            )}

            {role === 'admin' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Admin Email</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'adminEmail' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="e.g., organizer@xplorequest.com"
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
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused === 'adminPassword' && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                    ]}
                    placeholder="Enter password"
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
                label={loading ? 'Processing...' : (role === 'crew' ? 'Select Checkpoint Station' : 'Enter Dashboard')}
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
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.caption,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.fontSize.body,
    color: COLORS.text,
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    lineHeight: 16,
  },
  buttonSpacing: {
    marginTop: SPACING.sm,
  },
});
