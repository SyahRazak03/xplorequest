import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Polygon,
  Marker,
  type MapPressEvent,
  type LatLng,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Card, PrimaryButton, SecondaryButton, Badge, CustomModalDialog } from '../components';
import { useApp } from '../AppContext';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';
import type { EventConfig } from '../types';
import { saveBoundary, updateCheckpoint } from '../services/checkpointService';

interface CheckpointPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface PlaceSearchResult {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
  latitude?: number;
  longitude?: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

// Default initial camera centered on Taman Tasik Titiwangsa, Kuala Lumpur
const INITIAL_REGION = {
  latitude: 3.1764,
  longitude: 101.7061,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

// Initial default boundary vertices (real coordinates)
const DEFAULT_BOUNDARY_VERTICES: LatLng[] = [
  { latitude: 3.1795, longitude: 101.7035 },
  { latitude: 3.1802, longitude: 101.7085 },
  { latitude: 3.1765, longitude: 101.7115 },
  { latitude: 3.1725, longitude: 101.7080 },
  { latitude: 3.1740, longitude: 101.7025 },
];

// Single physical API key accessed via runtime process.env
const GOOGLE_MAPS_API_KEY =
  process.env['EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'] ||
  process.env['GOOGLE_MAPS_API_KEY_ANDROID'] ||
  process.env['GOOGLE_MAPS_API_KEY_IOS'] ||
  '';

const VENUE_DATABASE = [
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
  { name: 'Casaria Park', lat: 3.1492, lng: 101.6938 },
];

export default function AdminGeofenceDesignerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { checkpoints, setCheckpoints, user, activeEvent, setActiveEvent, setEvents, selectedEventId } = useApp();
  const mapRef = useRef<MapView>(null);

  // State for boundary polygon vertices (real GPS coordinates)
  const [vertices, setVertices] = useState<LatLng[]>(DEFAULT_BOUNDARY_VERTICES);
  const [currentCenter, setCurrentCenter] = useState<LatLng>({ latitude: 3.1764, longitude: 101.7061 });

  // Location Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Auto-center map & load saved geofence boundary or center around activeEvent location
  useEffect(() => {
    // 1. If activeEvent already has a saved custom geofence boundary (>= 3 vertices), load it!
    if (activeEvent?.geofenceBoundary && Array.isArray(activeEvent.geofenceBoundary) && activeEvent.geofenceBoundary.length >= 3) {
      const savedVertices = activeEvent.geofenceBoundary.map((v) => ({
        latitude: v.latitude,
        longitude: v.longitude,
      }));
      setVertices(savedVertices);

      // Compute centroid of saved polygon
      const avgLat = savedVertices.reduce((sum, v) => sum + v.latitude, 0) / savedVertices.length;
      const avgLng = savedVertices.reduce((sum, v) => sum + v.longitude, 0) / savedVertices.length;
      setCurrentCenter({ latitude: avgLat, longitude: avgLng });

      if (activeEvent.locationName) {
        setSearchQuery(activeEvent.locationName);
      }

      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: avgLat,
          longitude: avgLng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 800);
      }, 400);
      return;
    }

    // 2. Otherwise (first time opening for this event), calculate target venue coordinates
    let targetLat = activeEvent?.latitude;
    let targetLng = activeEvent?.longitude;

    if (!targetLat || !targetLng) {
      const locLower = (activeEvent?.locationName || '').toLowerCase();
      if (locLower) {
        const matched = VENUE_DATABASE.find(
          (v) => locLower.includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(locLower)
        );
        if (matched) {
          targetLat = matched.lat;
          targetLng = matched.lng;
        }
      }
    }

    if (targetLat && targetLng) {
      setCurrentCenter({ latitude: targetLat, longitude: targetLng });
      const newVertices: LatLng[] = [
        { latitude: targetLat + 0.003, longitude: targetLng - 0.0025 },
        { latitude: targetLat + 0.0035, longitude: targetLng + 0.0025 },
        { latitude: targetLat - 0.0005, longitude: targetLng + 0.0055 },
        { latitude: targetLat - 0.0045, longitude: targetLng + 0.002 },
        { latitude: targetLat - 0.003, longitude: targetLng - 0.0035 },
      ];
      setVertices(newVertices);
      if (activeEvent?.locationName) {
        setSearchQuery(activeEvent.locationName);
      }

      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: targetLat!,
          longitude: targetLng!,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 800);
      }, 400);
    }
  }, [activeEvent?.id, activeEvent?.geofenceBoundary]);

  // Checkpoints state for placements on real map
  const [checkpointPins, setCheckpointPins] = useState<CheckpointPin[]>(() => {
    return checkpoints
      .filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number')
      .map((c) => ({
        id: c.id,
        name: c.name,
        latitude: c.latitude,
        longitude: c.longitude,
      }));
  });

  useEffect(() => {
    if (checkpoints && checkpoints.length > 0) {
      setCheckpointPins(
        checkpoints
          .filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number')
          .map((c) => ({
            id: c.id,
            name: c.name,
            latitude: c.latitude,
            longitude: c.longitude,
          }))
      );
    }
  }, [checkpoints]);

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant: 'confirm' | 'danger' | 'success' | 'warning' | 'info';
    icon: any;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    variant: 'info',
    icon: 'information-circle-outline',
  });

  // Selected checkpoint from the palette to place on next click
  const [selectedPaletteCp, setSelectedPaletteCp] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Available Checkpoint Pins to Place - Dynamic from AppContext
  const cpPalette = checkpoints.map((cp) => {
    let icon = 'walk';
    let labelText = cp.name;

    if (cp.isStart) {
      icon = 'flag';
      labelText = `${cp.name} (Start)`;
    } else if (cp.isFinish) {
      icon = 'flag-outline';
      labelText = `${cp.name} (Finish)`;
    } else {
      const middleCPs = checkpoints.filter((c) => !c.isStart && !c.isFinish);
      const displayIdx = middleCPs.indexOf(cp) + 1;
      labelText = `${cp.name} (CP ${displayIdx})`;
      if (displayIdx === 1) icon = 'water';
      else if (displayIdx === 2) icon = 'git-commit';
      else if (displayIdx === 3) icon = 'rose';
      else if (displayIdx === 5) icon = 'water';
      else if (displayIdx === 6) icon = 'leaf';
    }

    return {
      id: cp.id,
      name: labelText,
      icon: icon,
    };
  });

  // Location Search Handler (Google Places Autocomplete API with Malaysia country bias)
  const handleSearchTextChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'PLACEHOLDER') {
          try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
              text
            )}&components=country:my&key=${GOOGLE_MAPS_API_KEY}`;
            const resp = await fetch(url);
            const json = await resp.json();
            if (json.status === 'OK' && json.predictions && json.predictions.length > 0) {
              setSearchResults(json.predictions);
              return;
            }
          } catch (e) {
            console.warn('Google places search error:', e);
          }
        }

        // OpenStreetMap Nominatim Free Geocoding API Search (Malaysia)
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            text
          )}&countrycodes=my&limit=8`;
          const nomResp = await fetch(nomUrl, {
            headers: { 'User-Agent': 'XploreQuestApp/1.0' },
          });
          const nomJson = await nomResp.json();
          if (Array.isArray(nomJson) && nomJson.length > 0) {
            const nomResults: PlaceSearchResult[] = nomJson.map((item: any, idx: number) => {
              const parts = item.display_name.split(',');
              const mainText = parts.slice(0, 2).join(',').trim();
              const secondaryText = parts.slice(2, 4).join(',').trim();
              return {
                place_id: `nom_${item.place_id || idx}`,
                description: item.display_name,
                structured_formatting: { main_text: mainText, secondary_text: secondaryText },
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
              };
            });
            setSearchResults(nomResults);
            return;
          }
        } catch (e) {
          console.warn('Nominatim search error:', e);
        }

        // Fallback search database for popular Malaysian event venues (works offline / demo)
        const textLower = text.toLowerCase();
        const demoVenues: PlaceSearchResult[] = [
          {
            place_id: 'v_pudu_ulu',
            description: 'Taman Pudu Ulu, Cheras, Kuala Lumpur',
            structured_formatting: { main_text: 'Taman Pudu Ulu', secondary_text: 'Cheras, Kuala Lumpur' },
            latitude: 3.1275,
            longitude: 101.7272,
          },
          {
            place_id: 'v_titwangsa',
            description: 'Taman Tasik Titiwangsa, Kuala Lumpur',
            structured_formatting: { main_text: 'Taman Tasik Titiwangsa', secondary_text: 'Kuala Lumpur' },
            latitude: 3.1764,
            longitude: 101.7061,
          },
          {
            place_id: 'v_langkawi',
            description: 'Kilim Karst Geoforest Park, Langkawi, Kedah',
            structured_formatting: { main_text: 'Kilim Karst Geoforest Park', secondary_text: 'Langkawi, Kedah' },
            latitude: 6.4061,
            longitude: 99.8540,
          },
          {
            place_id: 'v_bukit_jalil',
            description: 'Taman Rekreasi Bukit Jalil, Kuala Lumpur',
            structured_formatting: { main_text: 'Taman Rekreasi Bukit Jalil', secondary_text: 'Kuala Lumpur' },
            latitude: 3.0583,
            longitude: 101.6917,
          },
          {
            place_id: 'v_shah_alam',
            description: 'Taman Botani Negara Shah Alam, Selangor',
            structured_formatting: { main_text: 'Taman Botani Negara Shah Alam', secondary_text: 'Selangor' },
            latitude: 3.0945,
            longitude: 101.5118,
          },
        ];

        const matched = demoVenues.filter(
          (v) => v.description.toLowerCase().includes(textLower) || v.structured_formatting?.main_text.toLowerCase().includes(textLower)
        );

        if (matched.length > 0) {
          setSearchResults(matched);
        } else {
          // Dynamic fallback entry for custom search text
          setSearchResults([
            {
              place_id: 'v_custom',
              description: `${text}, Malaysia`,
              structured_formatting: { main_text: text, secondary_text: 'Kawasan Acara Malaysia' },
              latitude: 3.1479,
              longitude: 101.6940,
            },
          ]);
        }
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Place Selection Handler
  const handleSelectPlace = async (place: PlaceSearchResult) => {
    const venueTitle = place.structured_formatting?.main_text || place.description.split(',')[0];
    setSearchQuery(place.description);
    setSearchResults([]);
    setIsSearchFocused(false);

    let lat = place.latitude || 3.1275;
    let lng = place.longitude || 101.7272;

    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'PLACEHOLDER' && !place.place_id.startsWith('v_')) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
        const resp = await fetch(detailsUrl);
        const json = await resp.json();
        if (json.status === 'OK' && json.result?.geometry?.location) {
          lat = json.result.geometry.location.lat;
          lng = json.result.geometry.location.lng;
        }
      } catch (err) {
        console.warn('Place details error:', err);
      }
    }

    const targetCoord = { latitude: lat, longitude: lng };
    setCurrentCenter(targetCoord);

    // 1. Smoothly pan and zoom map camera to target venue location
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      1000
    );

    // 2. Prompt organizer to reset / re-center boundary vertices around new location
    setModalConfig({
      visible: true,
      title: 'Lokasi Acara Ditukar 📍',
      message: `Kamera peta telah bergerak ke "${venueTitle}".\n\nAdakah anda mahu menetapkan semula (re-center) bucu sempadan geofence di sekeliling lokasi baharu ini?`,
      variant: 'confirm',
      icon: 'navigate-outline',
      onConfirm: () => {
        recenterVerticesAround(lat, lng);
      },
    });
  };

  const recenterVerticesAround = (lat: number, lng: number) => {
    const newVertices: LatLng[] = [
      { latitude: lat + 0.003, longitude: lng - 0.0025 },
      { latitude: lat + 0.0035, longitude: lng + 0.0025 },
      { latitude: lat - 0.0005, longitude: lng + 0.0055 },
      { latitude: lat - 0.0045, longitude: lng + 0.002 },
      { latitude: lat - 0.003, longitude: lng - 0.0035 },
    ];
    setVertices(newVertices);
  };

  // Map click handler (tap to place checkpoint or add polygon vertex)
  const handleMapPress = (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;

    // 1. If a checkpoint from the palette is selected, place/update that pin
    if (selectedPaletteCp) {
      const cpItem = cpPalette.find((c) => c.id === selectedPaletteCp);
      if (cpItem) {
        setCheckpointPins((prev) => {
          const filtered = prev.filter((p) => p.id !== cpItem.id);
          return [
            ...filtered,
            {
              id: cpItem.id,
              name: cpItem.name,
              latitude: coord.latitude,
              longitude: coord.longitude,
            },
          ];
        });
        setSelectedPaletteCp(null);
        setModalConfig({
          visible: true,
          title: 'Pin Diletakkan 📍',
          message: `Pos Kawalan "${cpItem.name}" telah diletakkan pada koordinat (${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}).`,
          variant: 'info',
          icon: 'location-outline',
        });
      }
      return;
    }

    // 2. Otherwise, drop a new boundary vertex point
    setVertices((prev) => [...prev, coord]);
  };

  // Drag-and-drop handler for vertex marker
  const handleVertexDragEnd = (index: number, newCoord: LatLng) => {
    setVertices((prev) => {
      const updated = [...prev];
      updated[index] = newCoord;
      return updated;
    });
  };

  // Drag-and-drop handler for checkpoint pin marker repositioning
  const handlePinDragEnd = (pinId: string, newCoord: LatLng) => {
    setCheckpointPins((prev) =>
      prev.map((pin) =>
        pin.id === pinId
          ? { ...pin, latitude: newCoord.latitude, longitude: newCoord.longitude }
          : pin
      )
    );
  };

  const handleUndo = () => {
    if (vertices.length > 0) {
      setVertices((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setVertices([]);
  };

  const handleSave = async () => {
    if (vertices.length < 3) {
      setModalConfig({
        visible: true,
        title: 'Ralat Sempadan ⚠️',
        message: 'Sila masukkan sekurang-kurangnya 3 mata bucu untuk melengkapkan sempadan geofence.',
        variant: 'warning',
        icon: 'warning-outline',
      });
      return;
    }

    try {
      setIsSaving(true);
      const targetEventId = activeEvent?.id || selectedEventId || user?.eventId || 'EV-001';
      const token = user?.idToken || 'token-admin-casaria';

      // 1. Update AppContext state for checkpoints with any repositioned pin coordinates
      setCheckpoints((prevCheckpoints) =>
        prevCheckpoints.map((cp) => {
          const movedPin = checkpointPins.find((p) => p.id === cp.id);
          if (movedPin) {
            return { ...cp, latitude: movedPin.latitude, longitude: movedPin.longitude };
          }
          return cp;
        })
      );

      // 1b. Persist updated checkpoint coordinates to backend Firestore
      if (token) {
        for (const pin of checkpointPins) {
          try {
            await updateCheckpoint(
              targetEventId,
              pin.id,
              { latitude: pin.latitude, longitude: pin.longitude },
              token
            );
          } catch (pinErr) {
            console.warn(`Backend updateCheckpoint warning for ${pin.id}:`, pinErr);
          }
        }
      }

      // 2. Persist geofence boundary polygon vertices to backend & AppContext
      if (activeEvent) {
        const updatedEvent: EventConfig = {
          ...activeEvent,
          geofenceBoundary: vertices,
          latitude: currentCenter.latitude,
          longitude: currentCenter.longitude,
        };
        setActiveEvent(updatedEvent);
        if (setEvents) {
          setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
        }
      }

      if (token) {
        try {
          await saveBoundary(targetEventId, vertices, token);
        } catch (apiErr) {
          console.warn('Backend saveBoundary warning (saved locally to AppContext):', apiErr);
        }
      }

      setModalConfig({
        visible: true,
        title: 'Sempadan Disimpan 🎉',
        message: 'Sempadan Geofence Acara & peletakan pos kawalan berjaya disimpan ke dalam konfigurasi acara.',
        variant: 'success',
        icon: 'checkmark-circle-outline',
        onConfirm: () => navigation.goBack(),
      });
    } catch (err: any) {
      setModalConfig({
        visible: true,
        title: 'Gagal Menyimpan Sempadan',
        message: err.message || 'Sila cuba sebentar lagi.',
        variant: 'danger',
        icon: 'alert-circle-outline',
      });
    } finally {
      setIsSaving(false);
    }
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
          <Text style={styles.headerTitle}>Geofence Boundary Designer</Text>
          <Text style={styles.headerSubtitle}>Melukis sempadan geofence secara interaktif (Google Maps)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Editor Controls Card */}
        <Card role="admin" style={styles.controlCard}>
          <View style={styles.badgeRow}>
            <Badge label="Mod Suntingan Peta" state="info" />
            <Text style={styles.infoText}>Bucu: {vertices.length} | Pos: {checkpointPins.length}</Text>
          </View>
          <Text style={styles.guideText}>
            • Carian lokasi di atas peta untuk berpindah ke lokasi acara baharu (contoh: "Taman Pudu Ulu").{"\n"}
            • Ketik pada peta untuk menambah bucu sempadan poligon.{"\n"}
            • Seret penanda bucu biru untuk mengubah suai koordinat bucu.
          </Text>

          <View style={styles.buttonGroup}>
            <SecondaryButton
              label="Pusatkan Bucu"
              onPress={() => recenterVerticesAround(currentCenter.latitude, currentCenter.longitude)}
              role="admin"
              variant="outline"
              icon={<Ionicons name="reorder-four-outline" size={16} color={COLORS.admin.primary} />}
              style={styles.controlBtn}
            />
            <SecondaryButton
              label="Undur Bucu"
              onPress={handleUndo}
              role="admin"
              variant="outline"
              icon={<Ionicons name="arrow-undo-outline" size={16} color={COLORS.admin.primary} />}
              style={styles.controlBtn}
            />
            <SecondaryButton
              label="Padam Sempadan"
              onPress={handleClear}
              role="admin"
              variant="outline"
              icon={<Ionicons name="trash-outline" size={16} color={COLORS.danger} />}
              style={styles.controlBtn}
            />
          </View>
        </Card>

        {/* Real Google Maps Component Box with Floating Location Search Bar */}
        <View style={styles.mapOuterWrapper}>
          {/* Floating Location Search Overlay */}
          <View style={styles.searchOverlayContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color={COLORS.admin.primary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari lokasi venue (contoh: Taman Pudu Ulu)..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={handleSearchTextChange}
                onFocus={() => setIsSearchFocused(true)}
              />
              {isSearching ? (
                <ActivityIndicator size="small" color={COLORS.admin.primary} style={styles.searchSpinner} />
              ) : searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={styles.searchClearBtn}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Suggestions Dropdown List */}
            {searchResults.length > 0 && isSearchFocused && (
              <View style={styles.suggestionsDropdown}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectPlace(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={18} color={COLORS.admin.primary} style={styles.suggestionIcon} />
                    <View style={styles.suggestionTextWrapper}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {item.structured_formatting?.main_text || item.description.split(',')[0]}
                      </Text>
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {item.structured_formatting?.secondary_text || item.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.mapContainer}
            initialRegion={INITIAL_REGION}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsCompass={true}
            showsScale={true}
          >
            {/* Real Geofence Polygon Overlay */}
            {vertices.length >= 3 && (
              <Polygon
                coordinates={vertices}
                fillColor="rgba(16, 185, 129, 0.2)"
                strokeColor={COLORS.success}
                strokeWidth={3}
              />
            )}

            {/* Draggable Vertex Markers */}
            {vertices.map((vertex, idx) => (
              <Marker
                key={`vertex-${idx}`}
                coordinate={vertex}
                draggable
                onDragEnd={(e) => handleVertexDragEnd(idx, e.nativeEvent.coordinate)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.vertexMarker}>
                  <Text style={styles.vertexText}>{idx + 1}</Text>
                </View>
              </Marker>
            ))}

            {/* Placed Checkpoint Pins (Draggable for repositioning) */}
            {checkpointPins.map((pin) => (
              <Marker
                key={`pin-${pin.id}`}
                coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
                title={pin.name}
                description={pin.id}
                draggable
                onDragEnd={(e) => handlePinDragEnd(pin.id, e.nativeEvent.coordinate)}
              >
                <View style={styles.pinBubble}>
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                  <Text style={styles.pinText}>
                    {pin.id === 'CP-START' ? 'MULA' : pin.id === 'CP-TAMAT' ? 'TAMAT' : pin.id.replace('CP-00', '')}
                  </Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>

        {/* Checkpoint Pin Palette Section */}
        <View style={styles.paletteSection}>
          <Text style={styles.paletteTitle}>Palet Pos Kawalan (Pins)</Text>
          <Text style={styles.paletteSubtitle}>
            Ketik pada salah satu pin di bawah, kemudian ketik pada kawasan peta di atas untuk meletakkannya:
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteRow}>
            {cpPalette.map((cp) => {
              const isSelected = selectedPaletteCp === cp.id;
              return (
                <TouchableOpacity
                  key={cp.id}
                  style={[
                    styles.paletteCard,
                    isSelected && styles.paletteCardSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPaletteCp(isSelected ? null : cp.id)}
                >
                  <View
                    style={[
                      styles.paletteIconContainer,
                      { backgroundColor: isSelected ? COLORS.admin.primary : '#F1F3F2' },
                    ]}
                  >
                    <Ionicons
                      name={cp.icon as any}
                      size={20}
                      color={isSelected ? '#FFFFFF' : COLORS.text}
                    />
                  </View>
                  <Text style={[styles.paletteName, isSelected && styles.paletteNameSelected]}>
                    {cp.name}
                  </Text>
                  <Text style={styles.paletteId}>CP {cp.id.replace('CP-00', '')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Save Event Boundary */}
        <PrimaryButton
          label={isSaving ? 'Menyimpan...' : 'Simpan Sempadan Acara'}
          onPress={handleSave}
          role="admin"
          disabled={isSaving}
          style={styles.saveBtn}
          icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
        />
      </ScrollView>

      {/* Field Journal Custom Modal Dialog */}
      <CustomModalDialog
        visible={modalConfig.visible}
        variant={modalConfig.variant}
        icon={modalConfig.icon}
        title={modalConfig.title}
        message={modalConfig.message}
        buttons={[
          {
            text: modalConfig.variant === 'confirm' ? 'YA, RESET BUCU' : 'FAHAM',
            style: modalConfig.variant === 'confirm' ? 'default' : 'default',
            onPress: () => {
              const cb = modalConfig.onConfirm;
              setModalConfig((prev) => ({ ...prev, visible: false }));
              if (cb) cb();
            },
          },
          ...(modalConfig.variant === 'confirm'
            ? [
                {
                  text: 'KEKALKAN BUCU',
                  style: 'cancel' as const,
                  onPress: () => setModalConfig((prev) => ({ ...prev, visible: false })),
                },
              ]
            : []),
        ]}
        onDismiss={() => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
        }}
      />
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
    marginBottom: SPACING.md,
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
  controlCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
  },
  guideText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  controlBtn: {
    flex: 1,
  },
  mapOuterWrapper: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'visible',
    marginBottom: SPACING.md,
    zIndex: 10,
    ...SHADOWS.sm,
  },
  searchOverlayContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 999,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.admin.primary,
    paddingHorizontal: SPACING.sm,
    height: 44,
    ...SHADOWS.md,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    paddingVertical: 4,
  },
  searchSpinner: {
    marginLeft: 6,
  },
  searchClearBtn: {
    padding: 4,
  },
  suggestionsDropdown: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    maxHeight: 200,
    ...SHADOWS.lg,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
  suggestionSubtitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  mapContainer: {
    height: 380,
    width: '100%',
    borderRadius: RADIUS.md,
  },
  vertexMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.admin.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  vertexText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  pinBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.admin.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  pinText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  paletteSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  paletteTitle: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  paletteSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 15,
  },
  paletteRow: {
    gap: SPACING.sm,
    paddingBottom: 4,
  },
  paletteCard: {
    width: 110,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  paletteCardSelected: {
    borderColor: COLORS.admin.primary,
    backgroundColor: COLORS.admin.primaryLight,
  },
  paletteIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  paletteName: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  paletteNameSelected: {
    color: COLORS.admin.primary,
  },
  paletteId: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  saveBtn: {
    marginBottom: SPACING.xl,
  },
});
