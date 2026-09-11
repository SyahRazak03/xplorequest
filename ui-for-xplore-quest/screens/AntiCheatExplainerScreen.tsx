import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  Switch,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Card } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

const { width } = Dimensions.get('window');
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

interface ExplainerSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: any;
  iconColor: string;
  isErrorSlide?: boolean;
}

export default function AntiCheatExplainerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [cheatModeEnabled, setCheatModeEnabled] = useState(false);

  // Standard walkthrough slides
  const normalSlides: ExplainerSlide[] = [
    {
      id: 'step-1',
      title: '1. Pemilihan Kumpulan',
      subtitle: 'Marshal Memilih Pasukan Beratur',
      description: 'Marshal mengenal pasti pasukan di hadapan kaunter verifikasi fizikal dan memilih profil pasukan tersebut dalam aplikasi crew.',
      iconName: 'people-outline',
      iconColor: COLORS.admin.primary,
    },
    {
      id: 'step-2',
      title: '2. Kunci Kriptografi Server',
      subtitle: 'Penjanaan Tandatangan HMAC Unik',
      description: 'Server keselamatan menandatangani payload maklumat dengan kunci rahsia SHA-256 (HMAC). Token ini dikunci khas kepada Team ID kumpulan tersebut.',
      iconName: 'key-outline',
      iconColor: COLORS.pending,
    },
    {
      id: 'step-3',
      title: '3. Kod QR Dinamik 30s',
      subtitle: 'Had Masa Tempoh Imbasan Terhad',
      description: 'Aplikasi memaparkan Kod QR yang dijana dari token HMAC. Kod ini didatangkan dengan kitaran luput 30 saat untuk mengelakkan penyalahgunaan.',
      iconName: 'qr-code-outline',
      iconColor: COLORS.success,
    },
    {
      id: 'step-4',
      title: '4. Imbasan Kod QR',
      subtitle: 'Pasukan Mengimbas Menggunakan Telefon Pintar',
      description: 'Peserta menggunakan aplikasi telefon mereka sendiri untuk mengimbas Kod QR fizikal yang dipaparkan pada peranti Marshal di pos kawalan.',
      iconName: 'scan-outline',
      iconColor: COLORS.admin.accent,
    },
    {
      id: 'step-5',
      title: '5. Saringan Sempadan & Kelajuan',
      subtitle: 'Analisis Geolokasi & Halaju GPS',
      description: 'Sistem menyemak: Adakah peserta berada dalam radius geofence Pos Kawalan? Adakah beza jarak masa imbasan logik dengan kelajuan fizikal berlari?',
      iconName: 'navigate-outline',
      iconColor: COLORS.admin.primary,
    },
    {
      id: 'step-6',
      title: '6. Pengesahan Berjaya!',
      subtitle: 'Pos Kawalan Ditandakan Selesai',
      description: 'Selepas melepasi semua saringan keselamatan, status CP dikemas kini secara rasmi dan mata ganjaran dikreditkan terus ke papan pendahulu.',
      iconName: 'checkmark-done-circle-outline',
      iconColor: COLORS.success,
    },
  ];

  // Cheat scenario slide inserted when toggle is active
  const cheatSlide: ExplainerSlide = {
    id: 'cheat-error',
    title: '⚠️ KESAN KECURANGAN',
    subtitle: 'Screenshot Dikesan & Ditolak ❌',
    description: 'Sekiranya peserta menghantar screenshot Kod QR ke ahli kumpulan lain, saringan Server akan menolak imbasan kerana: (1) Tandatangan HMAC luput 30s, atau (2) ID Peranti tidak padan.',
    iconName: 'alert-circle-outline',
    iconColor: COLORS.danger,
    isErrorSlide: true,
  };

  // Compile slides dynamically based on toggle
  const slides = [...normalSlides];
  if (cheatModeEnabled) {
    // Insert cheat explanation slide right after step 3
    slides.splice(3, 0, cheatSlide);
  }

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setActiveIndex(currentIndex);
  };

  const handleToggleCheat = (value: boolean) => {
    setCheatModeEnabled(value);
    // Scroll back to index 0 when state changes to avoid index mismatches
    scrollViewRef.current?.scrollTo({ x: 0, animated: true });
    setActiveIndex(0);
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
          <Text style={styles.headerTitle}>Sistem Anti-Pintasan (Anti-Cheat)</Text>
          <Text style={styles.headerSubtitle}>Bagaimana XploreQuest menjamin integriti acara (Storytelling)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Commentary block explicitly noting this is a client walkthrough slide */}
        <View style={styles.commentaryBox}>
          <Ionicons name="bulb-outline" size={16} color={COLORS.admin.primary} />
          <Text style={styles.commentaryText}>
            <Text style={styles.boldText}>PENAFIAN TEKNIKAL:</Text> Screen ini dibina khas untuk persembahan (pitch/demo) bagi menjelaskan konsep kriptografi HMAC, geofencing GPS, dan velocity check secara ringkas kepada pihak pengurusan.
          </Text>
        </View>

        {/* Cheat Simulation Trigger Card */}
        <Card role="participant" style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleTitle}>Simulasi Penipuan Kongsi Screenshot</Text>
              <Text style={styles.toggleSubtitle}>
                Lihat apa yang berlaku jika QR dikongsi kepada kawan lain.
              </Text>
            </View>
            <Switch
              trackColor={{ false: COLORS.border, true: COLORS.danger }}
              thumbColor={cheatModeEnabled ? '#FFFFFF' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={handleToggleCheat}
              value={cheatModeEnabled}
            />
          </View>
        </Card>

        {/* Carousel Container */}
        <View style={styles.carouselWrapper}>
          <ScrollView
            ref={scrollViewRef}
            horizontal={true}
            pagingEnabled={true}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.carouselScrollView}
          >
            {slides.map((slide, idx) => (
              <View key={slide.id} style={styles.slideContainer}>
                <Card
                  role={slide.isErrorSlide ? 'participant' : 'admin'}
                  style={[
                    styles.slideCard,
                    slide.isErrorSlide && styles.errorCardBorder,
                  ]}
                  borderAccent="top"
                >
                  <View style={styles.slideContent}>
                    {/* Step Icon Graphic */}
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: slide.isErrorSlide ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.03)' },
                      ]}
                    >
                      <Ionicons name={slide.iconName} size={48} color={slide.iconColor} />
                    </View>

                    {/* Content text */}
                    <Text style={[styles.slideStepTitle, slide.isErrorSlide && styles.errorText]}>
                      {slide.title}
                    </Text>
                    <Text style={styles.slideStepSubtitle}>{slide.subtitle}</Text>
                    <Text style={styles.slideStepDescription}>{slide.description}</Text>

                    {/* Explainer graphics simulation (e.g. locks or ticks representation) */}
                    <View style={styles.badgeRow}>
                      {!slide.isErrorSlide ? (
                        <View style={styles.securitySealBadge}>
                          <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
                          <Text style={styles.sealText}>SINKRONISASI AKTIF</Text>
                        </View>
                      ) : (
                        <View style={[styles.securitySealBadge, styles.securitySealBadgeError]}>
                          <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
                          <Text style={[styles.sealText, styles.sealTextError]}>PERINTASAN DIHALANG</Text>
                        </View>

                      )}
                    </View>
                  </View>
                </Card>
              </View>
            ))}
          </ScrollView>

          {/* Carousel Dots Indicators */}
          <View style={styles.dotsRow}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  activeIndex === index && styles.dotActive,
                  slides[index].isErrorSlide && styles.dotError,
                  slides[index].isErrorSlide && activeIndex === index && styles.dotErrorActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Informational Cards detailing core security parameters */}
        <View style={styles.infoCardsSection}>
          <Text style={styles.infoSectionTitle}>Penyelesaian Anti-Cheat Multi-Faktor</Text>

          <View style={styles.infoGridRow}>
            <View style={styles.featureItem}>
              <Ionicons name="lock-closed" size={20} color={COLORS.admin.primary} />
              <Text style={styles.featureItemTitle}>Dynamic QR 30s</Text>
              <Text style={styles.featureItemDesc}>Satu kitaran kod QR hanya bertahan 30 saat untuk menghalang screenshot luput.</Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="locate" size={20} color={COLORS.admin.primary} />
              <Text style={styles.featureItemTitle}>GPS Geofencing</Text>
              <Text style={styles.featureItemDesc}>Memastikan peranti peserta betul-betul berada di dalam perimeter pos kawalan.</Text>
            </View>
          </View>

          <View style={styles.infoGridRow}>
            <View style={styles.featureItem}>
              <Ionicons name="speedometer" size={20} color={COLORS.admin.primary} />
              <Text style={styles.featureItemTitle}>Velocity Check</Text>
              <Text style={styles.featureItemDesc}>Sistem menghalang pergerakan kelajuan yang tidak logik (contohnya menaiki motosikal).</Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="finger-print" size={20} color={COLORS.admin.primary} />
              <Text style={styles.featureItemTitle}>Team Lock Device</Text>
              <Text style={styles.featureItemDesc}>Setiap pasukan dikunci kepada UUID peranti ahli untuk mengelak imbasan jarak jauh.</Text>
            </View>
          </View>
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

  scrollContainer: {
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
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
    lineHeight: 14,
  },
  commentaryBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  commentaryText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
  },
  boldText: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  toggleCard: {
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleTextContainer: {
    flex: 0.8,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  toggleSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  carouselWrapper: {
    alignItems: 'center',
  },
  carouselScrollView: {
    width: width,
  },
  slideContainer: {
    width: width,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  slideCard: {
    padding: SPACING.lg,
    height: 320,
    marginBottom: 0,
    justifyContent: 'center',
  },
  errorCardBorder: {
    borderColor: COLORS.danger,
    borderWidth: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
  },
  slideContent: {
    alignItems: 'center',
    textAlign: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  slideStepTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  errorText: {
    color: COLORS.danger,
  },
  slideStepSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
  },

  slideStepDescription: {
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  badgeRow: {
    marginTop: SPACING.md,
  },
  securitySealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: RADIUS.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  securitySealBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  sealText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  sealTextError: {
    color: COLORS.danger,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.admin.primary,
    width: 16,
  },
  dotError: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  dotErrorActive: {
    backgroundColor: COLORS.danger,
    width: 16,
  },
  infoCardsSection: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  infoGridRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  featureItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 4,
    ...SHADOWS.sm,
  },

  featureItemTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: 4,
  },
  featureItemDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 14,
  },
});
