import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { PROVIDER_GOOGLE, Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useApp } from '../AppContext';
import { createLiveEvent } from '../services/eventService';
import { Card, PrimaryButton, SecondaryButton, Badge } from '../components';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import type { EventConfig } from '../types';

const GOOGLE_MAPS_API_KEY =
  process.env['EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'] ||
  process.env['GOOGLE_MAPS_API_KEY_ANDROID'] ||
  process.env['GOOGLE_MAPS_API_KEY_IOS'] ||
  '';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const LOCATION_PRESETS = [
  { name: 'Taman Tasik Titiwangsa, KL', lat: 3.1764, lng: 101.7061 },
  { name: 'Pusat Rekreasi Air Putrajaya', lat: 2.9213, lng: 101.6964 },
  { name: 'Dataran Merdeka, Kuala Lumpur', lat: 3.1492, lng: 101.6938 },
  { name: 'Taman Botani Perdana, KL', lat: 3.1444, lng: 101.6853 },
];

const DATE_PRESETS = [
  '27 Jun 2026',
  '15 Jul 2026',
  '31 Ogo 2026',
  '16 Sep 2026',
  '01 Dis 2026',
];

const TIME_PRESETS = [
  '07:00 AM',
  '07:30 AM',
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
];

export default function AdminCreateEventScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, setActiveEvent, setCrewPinCode, setEvents } = useApp();

  // Form Fields State
  const [eventName, setEventName] = useState('');
  const [locationName, setLocationName] = useState('Taman Tasik Titiwangsa, KL');
  const [eventCoords, setEventCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 3.1764,
    longitude: 101.7061,
  });

  const [eventDate, setEventDate] = useState('27 Jun 2026');
  const [startTime, setStartTime] = useState('08:00 AM');
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [crewCode, setCrewCode] = useState('');

  // Modals state
  const [showMapModal, setShowMapModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Interactive Calendar & Time Picker States
  const [calMonth, setCalMonth] = useState(5); // June (0-indexed)
  const [calYear, setCalYear] = useState(2026);
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  // Interactive Map & Location Search States
  const mapRef = useRef<MapView>(null);
  const searchDebounceRef = useRef<any>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [mapSearchResults, setMapSearchResults] = useState<Array<{ name: string; lat: number; lng: number }>>([]);

  const VENUE_SEARCH_DATABASE = [
    { name: 'Dataran Merdeka, Kuala Lumpur', lat: 3.1492, lng: 101.6938 },
    { name: 'Taman Tasik Titiwangsa, Kuala Lumpur', lat: 3.1764, lng: 101.7061 },
    { name: 'Pusat Rekreasi Air Putrajaya', lat: 2.9213, lng: 101.6964 },
    { name: 'Taman Botani Perdana, Kuala Lumpur', lat: 3.1444, lng: 101.6853 },
    { name: 'Taman Pudu Ulu, Cheras, Kuala Lumpur', lat: 3.1275, lng: 101.7272 },
    { name: 'Kilim Karst Geoforest Park, Langkawi, Kedah', lat: 6.4061, lng: 99.8540 },
    { name: 'Taman Rekreasi Bukit Jalil, Kuala Lumpur', lat: 3.0583, lng: 101.6917 },
    { name: 'Taman Botani Negara Shah Alam, Selangor', lat: 3.0945, lng: 101.5118 },
    { name: 'KLCC Park, Kuala Lumpur', lat: 3.1558, lng: 101.7145 },
    { name: 'Taman Sri Rampai, Kuala Lumpur', lat: 3.1972, lng: 101.7348 },
    { name: 'Dataran Pahlawan, Melaka', lat: 2.1906, lng: 102.2505 },
    { name: 'Padang Kota Lama, Penang', lat: 5.4208, lng: 100.3421 },
    { name: 'Taman Merdeka, Johor Bahru', lat: 1.4728, lng: 103.7431 },
  ];

  const handleSearchLocationOnMap = (query: string) => {
    setMapSearchQuery(query);
    if (!query.trim()) {
      setMapSearchResults([]);
      setIsSearchingLocation(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    setIsSearchingLocation(true);

    searchDebounceRef.current = setTimeout(async () => {
      const results: Array<{ name: string; lat: number; lng: number }> = [];

      try {
        // 1. Check Google Places API if key exists
        if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'PLACEHOLDER') {
          try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
              query
            )}&components=country:my&key=${GOOGLE_MAPS_API_KEY}`;
            const resp = await fetch(url);
            const json = await resp.json();
            if (json.status === 'OK' && json.predictions) {
              for (const pred of json.predictions.slice(0, 4)) {
                try {
                  const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry,name,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
                  const detResp = await fetch(detUrl);
                  const detJson = await detResp.json();
                  if (detJson.status === 'OK' && detJson.result?.geometry?.location) {
                    results.push({
                      name: detJson.result.name || pred.structured_formatting?.main_text || pred.description,
                      lat: detJson.result.geometry.location.lat,
                      lng: detJson.result.geometry.location.lng,
                    });
                  }
                } catch {
                  // Ignore single item error
                }
              }
            }
          } catch (e) {
            console.warn('Google places search error:', e);
          }
        }

        // 2. OpenStreetMap Nominatim Free Geocoding Search (Malaysia)
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&countrycodes=my&limit=8`;
          const nomResp = await fetch(nomUrl, {
            headers: { 'User-Agent': 'XploreQuestApp/1.0' },
          });
          const nomJson = await nomResp.json();
          if (Array.isArray(nomJson)) {
            for (const item of nomJson) {
              const displayName = item.display_name;
              const parts = displayName.split(',');
              const shortName = parts.slice(0, 3).join(',').trim();
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lon);
              if (!isNaN(lat) && !isNaN(lng)) {
                if (!results.some((r) => Math.abs(r.lat - lat) < 0.0001 && Math.abs(r.lng - lng) < 0.0001)) {
                  results.push({ name: shortName, lat, lng });
                }
              }
            }
          }
        } catch (e) {
          console.warn('Nominatim search error:', e);
        }

        // 3. Fallback matching from local presets
        const qLower = query.toLowerCase().trim();
        const matchedLocal = VENUE_SEARCH_DATABASE.filter((item) =>
          item.name.toLowerCase().includes(qLower)
        );
        for (const localItem of matchedLocal) {
          if (!results.some((r) => r.name.toLowerCase() === localItem.name.toLowerCase())) {
            results.push(localItem);
          }
        }

        setMapSearchResults(results);
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
  };

  const handleSelectMapSearchResult = (item: { name: string; lat: number; lng: number }) => {
    setLocationName(item.name);
    setEventCoords({ latitude: item.lat, longitude: item.lng });
    setMapSearchQuery(item.name);
    setMapSearchResults([]);
    mapRef.current?.animateToRegion(
      {
        latitude: item.lat,
        longitude: item.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      800
    );
  };

  const handleMapPressOrDrag = async (coords: { latitude: number; longitude: number }) => {
    setEventCoords(coords);
    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      400
    );

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
        { headers: { 'User-Agent': 'XploreQuestApp/1.0' } }
      );
      const json = await resp.json();
      if (json && json.display_name) {
        const parts = json.display_name.split(',');
        const shortName = parts.slice(0, 3).join(',').trim();
        setLocationName(shortName);
        setMapSearchQuery(shortName);
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
  };

  const MONTH_NAMES_MY = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const handleSelectCalendarDay = (day: number) => {
    const monthShort = MONTH_NAMES_MY[calMonth].slice(0, 3);
    const dayStr = day.toString().padStart(2, '0');
    setEventDate(`${dayStr} ${monthShort} ${calYear}`);
  };

  const handleUpdateTime = (h: string, m: string, p: 'AM' | 'PM') => {
    setSelectedHour(h);
    setSelectedMinute(m);
    setSelectedPeriod(p);
    setStartTime(`${h}:${m} ${p}`);
  };

  // Web Pre-Registration Form Fields State
  const [urlSlug, setUrlSlug] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [entryFee, setEntryFee] = useState('50');
  const [paymentBankDetails, setPaymentBankDetails] = useState('Maybank 564123456789 (XploreQuest Resources)');
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [paymentQrUri, setPaymentQrUri] = useState<string | null>(null);

  // Success State
  const [isSuccess, setIsSuccess] = useState(false);

  const generateRandomCrewCode = () => {
    return Math.floor(Math.random() * 9000 + 1000).toString();
  };

  useEffect(() => {
    setCrewCode(generateRandomCrewCode());
  }, []);

  const effectiveSlug = isCustomSlug ? urlSlug : slugify(eventName);

  const handlePickImage = async (target: 'banner' | 'payment_qr') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Kebenaran Diperlukan', 'Kebenaran akses ke galeri gambar diperlukan.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Had Saiz Melebihi', 'Saiz gambar melebihi 5MB.');
          return;
        }
        if (target === 'banner') {
          setBannerUri(asset.uri);
        } else {
          setPaymentQrUri(asset.uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleIncrement = () => {
    if (maxTeamSize < 6) {
      setMaxTeamSize((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (maxTeamSize > 2) {
      setMaxTeamSize((prev) => prev - 1);
    }
  };

  const handleSelectLocationPreset = (preset: { name: string; lat: number; lng: number }) => {
    setLocationName(preset.name);
    setEventCoords({ latitude: preset.lat, longitude: preset.lng });
  };

  const handleSubmit = async () => {
    if (!eventName.trim()) {
      Alert.alert('Error', 'Please enter Event Name.');
      return;
    }
    if (!locationName.trim()) {
      Alert.alert('Error', 'Please enter Event Location.');
      return;
    }
    if (!eventDate.trim()) {
      Alert.alert('Error', 'Please enter Event Date.');
      return;
    }
    if (!startTime.trim()) {
      Alert.alert('Error', 'Please enter Start Time.');
      return;
    }

    const finalSlug = effectiveSlug || `event-${Math.floor(Math.random() * 900 + 100)}`;
    const parsedFee = parseFloat(entryFee) || 0;

    const newEvent: EventConfig = {
      id: `EV-${Math.floor(Math.random() * 900 + 100)}`,
      name: eventName,
      date: eventDate,
      maxDurationSeconds: 14400,
      locationName: locationName,
      totalCheckpoints: 8,
      urlSlug: finalSlug,
      entryFee: parsedFee,
      paymentBankDetails: paymentBankDetails,
      bannerImageUrl: bannerUri,
      paymentQrImageUrl: paymentQrUri,
      latitude: eventCoords.latitude,
      longitude: eventCoords.longitude,
      joinCode: 'XT2026',
    };

    setActiveEvent(newEvent);
    if (setEvents) {
      setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
    }

    // Persist event to Firestore database via Cloud API (Admin SDK) so web form urlSlug works live!
    try {
      const persistedEvent = await createLiveEvent(newEvent, user?.idToken, user?.id);
      if (setEvents && persistedEvent) {
        setEvents((prev) => [persistedEvent, ...prev.filter((e) => e.id !== newEvent.id && e.id !== persistedEvent.id)]);
        setActiveEvent(persistedEvent);
      }
    } catch (err) {
      console.warn('Failed to persist live event:', err);
    }

    setCrewPinCode(crewCode);
    setIsSuccess(true);
  };

  const handleBackToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToDashboard}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>New Event Setup</Text>
              <Text style={styles.headerSubtitle}>Stage 4.1 Admin Console (ADM-01)</Text>
            </View>
          </View>

          {isSuccess ? (
            /* Success State View */
            <View style={styles.successContainer}>
              <View style={styles.successBadgeContainer}>
                <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
                <Text style={styles.successTitle}>Event Created Successfully!</Text>
                <Text style={styles.successSubtitle}>
                  System is now ready to receive team registrations.
                </Text>
              </View>

              {/* Crew Access PIN Banner */}
              <View
                style={[
                  styles.shareBanner,
                  {
                    marginTop: SPACING.md,
                    backgroundColor: COLORS.crew.primaryLight,
                    borderColor: COLORS.crew.primary,
                  },
                ]}
              >
                <Text style={[styles.shareLabel, { color: COLORS.crew.primary }]}>
                  CREW MARSHAL LOGIN PIN
                </Text>
                <Text style={[styles.shareCode, { color: COLORS.crew.primary }]}>{crewCode}</Text>
                <TouchableOpacity
                  style={styles.shareAction}
                  onPress={() => Alert.alert('Share PIN', 'Crew PIN copied!')}
                >
                  <Ionicons name="copy-outline" size={16} color={COLORS.crew.primary} />
                  <Text style={[styles.shareActionText, { color: COLORS.crew.primary }]}>
                    Copy PIN
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Summary Card */}
              <Card role="admin" title="Event Summary" borderAccent="left">
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Event Name</Text>
                    <Text style={styles.summaryValue}>{eventName}</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Location</Text>
                    <Text style={styles.summaryValue}>{locationName}</Text>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Date</Text>
                      <Text style={styles.summaryValue}>{eventDate}</Text>
                    </View>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Start Time</Text>
                      <Text style={styles.summaryValue}>{startTime}</Text>
                    </View>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Max Team Size</Text>
                      <Text style={styles.summaryValue}>{maxTeamSize} Members</Text>
                    </View>
                    <View style={styles.summaryItemHalf}>
                      <Text style={styles.summaryLabel}>Time Limit</Text>
                      <Text style={styles.summaryValue}>4 Hours</Text>
                    </View>
                  </View>
                </View>
              </Card>

              <PrimaryButton
                label="To Admin Dashboard"
                onPress={handleBackToDashboard}
                role="admin"
                style={styles.actionButton}
              />
            </View>
          ) : (
            /* Creation Form View */
            <View style={styles.formContainer}>
              <Card role="admin" title="Event Parameter Configuration" borderAccent="top">
                {/* Event Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Event Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Example: Jungle Challenge 2026"
                    value={eventName}
                    onChangeText={setEventName}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                {/* Location Input with Presets & Map Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Event Location</Text>
                  <View style={styles.inputWithIconRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder="Example: Titiwangsa Lake Park, KL"
                      value={locationName}
                      onChangeText={setLocationName}
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => setShowMapModal(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map-outline" size={20} color={COLORS.admin.primary} />
                      <Text style={styles.iconActionText}>Map</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Location Presets Horizontal Chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetsRow}
                  >
                    {LOCATION_PRESETS.map((preset, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.presetChip,
                          locationName === preset.name && styles.presetChipActive,
                        ]}
                        onPress={() => handleSelectLocationPreset(preset)}
                      >
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={locationName === preset.name ? COLORS.admin.primary : COLORS.textMuted}
                        />
                        <Text
                          style={[
                            styles.presetChipText,
                            locationName === preset.name && styles.presetChipTextActive,
                          ]}
                        >
                          {preset.name.split(',')[0]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Date & Time Row with Direct Manual Input & Interactive Pickers */}
                <View style={styles.rowInputs}>
                  {/* Date Input */}
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Date</Text>
                    <View style={styles.pickerTriggerInput}>
                      <TextInput
                        style={{ flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 2, paddingHorizontal: 0 }}
                        value={eventDate}
                        onChangeText={setEventDate}
                        placeholder="Example: 27 June 2026"
                        placeholderTextColor={COLORS.textMuted}
                      />
                      <TouchableOpacity
                        onPress={() => setShowDateModal(true)}
                        activeOpacity={0.7}
                        style={{ paddingLeft: 6 }}
                      >
                        <Ionicons name="calendar-outline" size={20} color={COLORS.admin.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Time Input */}
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.md }]}>
                    <Text style={styles.label}>Start Time</Text>
                    <View style={styles.pickerTriggerInput}>
                      <TextInput
                        style={{ flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 2, paddingHorizontal: 0 }}
                        value={startTime}
                        onChangeText={setStartTime}
                        placeholder="Example: 08:00 AM"
                        placeholderTextColor={COLORS.textMuted}
                      />
                      <TouchableOpacity
                        onPress={() => setShowTimeModal(true)}
                        activeOpacity={0.7}
                        style={{ paddingLeft: 6 }}
                      >
                        <Ionicons name="time-outline" size={20} color={COLORS.admin.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Stepper: Max Team Size */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Maximum Team Size Limit</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={[styles.stepperButton, maxTeamSize <= 2 && styles.stepperButtonDisabled]}
                      onPress={handleDecrement}
                      disabled={maxTeamSize <= 2}
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        color={maxTeamSize <= 2 ? COLORS.textMuted : COLORS.admin.primary}
                      />
                    </TouchableOpacity>

                    <View style={styles.stepperValueContainer}>
                      <Text style={styles.stepperValueText}>{maxTeamSize}</Text>
                      <Text style={styles.stepperValueLabel}>Members / Team</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.stepperButton, maxTeamSize >= 6 && styles.stepperButtonDisabled]}
                      onPress={handleIncrement}
                      disabled={maxTeamSize >= 6}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        color={maxTeamSize >= 6 ? COLORS.textMuted : COLORS.admin.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>

              {/* Web Pre-Registration Configuration Card (Stage 17) */}
              <Card role="admin" title="Web Pre-Registration Configuration" borderAccent="top">
                {/* URL Slug Input & Preview */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Web Form Address Link (URL Slug)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Example: explorace-tasik-titiwangsa-2026"
                    value={isCustomSlug ? urlSlug : effectiveSlug}
                    onChangeText={(text) => {
                      setIsCustomSlug(true);
                      setUrlSlug(slugify(text));
                    }}
                    autoCapitalize="none"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.slugPreviewText}>
                    🌐 Form Link: xplorequest-cab6c.web.app/registration-form/{effectiveSlug || 'event-name'}
                  </Text>
                </View>

                {/* Entry Fee Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Team Registration Fee (RM)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Example: 50"
                    keyboardType="numeric"
                    value={entryFee}
                    onChangeText={setEntryFee}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                {/* Bank Details Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Payment Bank Account Details</Text>
                  <TextInput
                    style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                    placeholder="Bank Name, Account Number, Recipient Name"
                    multiline
                    numberOfLines={3}
                    value={paymentBankDetails}
                    onChangeText={setPaymentBankDetails}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                {/* Image Upload Pickers: Banner & Payment QR */}
                <View style={styles.imagePickersRow}>
                  {/* Banner Image Picker */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Banner Image</Text>
                    <TouchableOpacity
                      style={styles.uploadPickerBtn}
                      onPress={() => handlePickImage('banner')}
                    >
                      <Ionicons name="image-outline" size={20} color={COLORS.admin.primary} />
                      <Text style={styles.uploadPickerText}>
                        {bannerUri ? 'Change Banner' : 'Upload Banner'}
                      </Text>
                    </TouchableOpacity>
                    {bannerUri && (
                      <Image source={{ uri: bannerUri }} style={styles.imagePreviewThumb} />
                    )}
                  </View>

                  {/* Payment QR Image Picker */}
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={styles.label}>Payment QR</Text>
                    <TouchableOpacity
                      style={styles.uploadPickerBtn}
                      onPress={() => handlePickImage('payment_qr')}
                    >
                      <Ionicons name="qr-code-outline" size={20} color={COLORS.admin.primary} />
                      <Text style={styles.uploadPickerText}>
                        {paymentQrUri ? 'Change QR' : 'Upload QR'}
                      </Text>
                    </TouchableOpacity>
                    {paymentQrUri && (
                      <Image source={{ uri: paymentQrUri }} style={styles.imagePreviewThumb} />
                    )}
                  </View>
                </View>
              </Card>

              {/* Submit Action */}
              <PrimaryButton
                label="Create & Launch Event"
                onPress={handleSubmit}
                role="admin"
                style={styles.actionButton}
                icon={<Ionicons name="rocket-outline" size={18} color={COLORS.textLight} />}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Map Picker Modal with Search & Responsive Notch Spacing */}
      <Modal visible={showMapModal} animationType="slide" onRequestClose={() => setShowMapModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
          {/* Header with Android Notch / Status Bar Padding */}
          <View
            style={[
              styles.modalHeader,
              { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 12 },
            ]}
          >
            <TouchableOpacity onPress={() => setShowMapModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitleText}>Select Event Location on Map</Text>
            <TouchableOpacity
              onPress={() => setShowMapModal(false)}
              style={styles.modalSaveBtn}
            >
              <Text style={styles.modalSaveText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, position: 'relative' }}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: eventCoords.latitude,
                longitude: eventCoords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={(e) => handleMapPressOrDrag(e.nativeEvent.coordinate)}
            >
              <Marker
                coordinate={eventCoords}
                title={locationName || 'Event Location'}
                draggable
                onDragEnd={(e) => handleMapPressOrDrag(e.nativeEvent.coordinate)}
              />
            </MapView>

            {/* Interactive Location Search Bar Floating Card */}
            <View style={styles.mapSearchContainer}>
              <View style={styles.mapSearchInputRow}>
                {isSearchingLocation ? (
                  <ActivityIndicator size="small" color={COLORS.admin.primary} />
                ) : (
                  <Ionicons name="search" size={18} color={COLORS.admin.primary} />
                )}
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search location in Malaysia (e.g., Casa Ria, KLCC...)"
                  placeholderTextColor={COLORS.textMuted}
                  value={mapSearchQuery}
                  onChangeText={(text) => handleSearchLocationOnMap(text)}
                />
                {mapSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setMapSearchQuery('');
                      setMapSearchResults([]);
                      setIsSearchingLocation(false);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results Dropdown List */}
              {mapSearchResults.length > 0 && (
                <ScrollView
                  style={styles.mapSearchResultsList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {mapSearchResults.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.mapSearchResultItem}
                      onPress={() => handleSelectMapSearchResult(item)}
                    >
                      <Ionicons name="location" size={16} color={COLORS.admin.primary} />
                      <Text style={styles.mapSearchResultText} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Map Instruction Floating Chip */}
            <View style={styles.mapInstructionChip}>
              <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.mapInstructionText}>
                Use search above or tap on map to set event location coordinates.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Interactive Date Picker Modal */}
      <Modal visible={showDateModal} transparent animationType="fade" onRequestClose={() => setShowDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={18} color={COLORS.admin.primary} />
                <Text style={styles.modalCardTitle}>Select Event Date</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Direct Manual Date Input */}
            <View style={{ width: '100%', marginTop: SPACING.md }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 }}>
                ENTER MANUAL DATE
              </Text>
              <TextInput
                style={styles.textInput}
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="Type date (Example: 27 June 2026)"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Interactive Calendar Month Grid */}
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
                  <Ionicons name="chevron-back" size={18} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.calMonthTitle}>
                  {MONTH_NAMES_MY[calMonth]} {calYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Day Headers */}
              <View style={styles.calDaysHeader}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, idx) => (
                  <Text key={idx} style={styles.calDayHeaderCell}>{day}</Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.calGrid}>
                {Array.from({ length: new Date(calYear, calMonth, 1).getDay() }, (_, i) => (
                  <View key={`empty-${i}`} style={styles.calDayCellEmpty} />
                ))}
                {Array.from({ length: new Date(calYear, calMonth + 1, 0).getDate() }, (_, i) => {
                  const dayNum = i + 1;
                  const dayStr = dayNum.toString().padStart(2, '0');
                  const monthShort = MONTH_NAMES_MY[calMonth].slice(0, 3);
                  const thisDateStr = `${dayStr} ${monthShort} ${calYear}`;
                  const isSelected = eventDate === thisDateStr;

                  return (
                    <TouchableOpacity
                      key={dayNum}
                      style={[styles.calDayCell, isSelected && styles.calDayCellSelected]}
                      onPress={() => handleSelectCalendarDay(dayNum)}
                    >
                      <Text style={[styles.calDayCellText, isSelected && styles.calDayCellTextSelected]}>
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Preset Suggestions Chips */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, alignSelf: 'flex-start', marginTop: SPACING.xs }}>
              QUICK PRESETS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%', marginVertical: SPACING.xs }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DATE_PRESETS.map((d, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.presetChip, eventDate === d && styles.presetChipActive]}
                    onPress={() => setEventDate(d)}
                  >
                    <Text style={[styles.presetChipText, eventDate === d && styles.presetChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <PrimaryButton
              label="Confirm Date"
              onPress={() => setShowDateModal(false)}
              role="admin"
              style={{ width: '100%', marginTop: SPACING.xs }}
            />
          </View>
        </View>
      </Modal>

      {/* Interactive Time Picker Modal */}
      <Modal visible={showTimeModal} transparent animationType="fade" onRequestClose={() => setShowTimeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time" size={18} color={COLORS.admin.primary} />
                <Text style={styles.modalCardTitle}>Select Start Time</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Direct Manual Time Input */}
            <View style={{ width: '100%', marginTop: SPACING.md }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 }}>
                ENTER MANUAL TIME
              </Text>
              <TextInput
                style={styles.textInput}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="Type time (Example: 08:00 AM)"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Interactive Time Dial Grid */}
            <View style={styles.timePickerContainer}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 }}>
                SELECT HOUR:
              </Text>
              <View style={styles.timePillsRow}>
                {['06', '07', '08', '09', '10', '11', '12'].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.timePill, selectedHour === h && styles.timePillActive]}
                    onPress={() => handleUpdateTime(h, selectedMinute, selectedPeriod)}
                  >
                    <Text style={[styles.timePillText, selectedHour === h && styles.timePillTextActive]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: SPACING.xs, marginBottom: 4 }}>
                SELECT MINUTE:
              </Text>
              <View style={styles.timePillsRow}>
                {['00', '15', '30', '45'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.timePill, selectedMinute === m && styles.timePillActive]}
                    onPress={() => handleUpdateTime(selectedHour, m, selectedPeriod)}
                  >
                    <Text style={[styles.timePillText, selectedMinute === m && styles.timePillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: SPACING.xs, marginBottom: 4 }}>
                AM / PM:
              </Text>
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                {(['AM', 'PM'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.periodBtn, selectedPeriod === p && styles.periodBtnActive]}
                    onPress={() => handleUpdateTime(selectedHour, selectedMinute, p)}
                  >
                    <Text style={[styles.periodBtnText, selectedPeriod === p && styles.periodBtnTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <PrimaryButton
              label="Confirm Time"
              onPress={() => setShowTimeModal(false)}
              role="admin"
              style={{ width: '100%', marginTop: SPACING.md }}
            />
          </View>
        </View>
      </Modal>
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
    padding: SPACING.md,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  formContainer: {
    gap: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
  },
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.admin.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    gap: 4,
  },
  iconActionText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  presetsRow: {
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    gap: 4,
  },
  presetChipActive: {
    backgroundColor: COLORS.admin.primaryLight,
    borderColor: COLORS.admin.primary,
  },
  presetChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  presetChipTextActive: {
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  pickerTriggerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  pickerTriggerText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: 8,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  stepperButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F3F2',
  },
  stepperValueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  stepperValueLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  successContainer: {
    gap: SPACING.lg,
  },
  successBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
    marginTop: SPACING.md,
  },
  successSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  shareBanner: {
    backgroundColor: '#E3EDF7',
    borderWidth: 2,
    borderColor: COLORS.admin.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    letterSpacing: 1.5,
  },
  shareCode: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
    letterSpacing: 6,
    marginVertical: SPACING.xs,
  },
  shareAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.admin.primary,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    gap: 4,
    marginTop: 4,
    ...SHADOWS.sm,
  },
  shareActionText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  summaryGrid: {
    gap: SPACING.md,
  },
  summaryItem: {
    flexDirection: 'column',
  },
  summaryItemRow: {
    flexDirection: 'row',
  },
  summaryItemHalf: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: 2,
  },
  slugPreviewText: {
    fontSize: 11,
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginTop: 6,
  },
  imagePickersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.xs,
  },
  uploadPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.xs,
    gap: 6,
  },
  uploadPickerText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.admin.primary,
  },
  imagePreviewThumb: {
    width: '100%',
    height: 70,
    borderRadius: RADIUS.xs,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.admin.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  mapInstructionChip: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(28, 46, 36, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapInstructionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.semiBold,
    flex: 1,
  },
  mapSearchContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  mapSearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    gap: 8,
    ...SHADOWS.md,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
  },
  mapSearchResultsList: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 200,
    ...SHADOWS.md,
  },
  mapSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  mapSearchResultText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  modalCardTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  modalOptionActive: {
    backgroundColor: COLORS.admin.primaryLight,
    borderColor: COLORS.admin.primary,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  modalOptionTextActive: {
    color: COLORS.admin.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  calendarContainer: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  calNavBtn: {
    padding: 4,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calMonthTitle: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  calDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
    marginBottom: 4,
  },
  calDayHeaderCell: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calDayCellEmpty: {
    width: '14.28%',
    height: 28,
  },
  calDayCell: {
    width: '14.28%',
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.xs,
  },
  calDayCellSelected: {
    backgroundColor: COLORS.admin.primary,
  },
  calDayCellText: {
    fontSize: 11,
    color: COLORS.text,
  },
  calDayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timePickerContainer: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  timePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timePill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timePillActive: {
    backgroundColor: COLORS.admin.primary,
    borderColor: COLORS.admin.primary,
  },
  timePillText: {
    fontSize: 11,
    color: COLORS.text,
  },
  timePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodBtnActive: {
    backgroundColor: COLORS.admin.primary,
    borderColor: COLORS.admin.primary,
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
