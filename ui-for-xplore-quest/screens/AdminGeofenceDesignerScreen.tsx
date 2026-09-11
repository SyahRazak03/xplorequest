import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
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
import { saveBoundary } from '../services/checkpointService';

interface CheckpointPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
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

export default function AdminGeofenceDesignerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { checkpoints, user } = useApp();
  const mapRef = useRef<MapView>(null);

  // State for boundary polygon vertices (real GPS coordinates)
  const [vertices, setVertices] = useState<LatLng[]>(DEFAULT_BOUNDARY_VERTICES);

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
      const eventId = user?.eventId || 'EVT-001';
      const token = user?.idToken || '';

      if (token) {
        await saveBoundary(eventId, vertices, token);
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
            • Ketik pada peta untuk menambah bucu sempadan poligon.{"\n"}
            • Seret penanda bucu biru untuk mengubah suai koordinat bucu.{"\n"}
            • Pilih pin di bawah untuk meletakkan Pos Kawalan pada peta GPS sebenar.
          </Text>

          <View style={styles.buttonGroup}>
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

        {/* Real Google Maps Component Box */}
        <View style={styles.mapOuterWrapper}>
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
            text: 'FAHAM',
            style: 'default',
            onPress: () => {
              const cb = modalConfig.onConfirm;
              setModalConfig((prev) => ({ ...prev, visible: false }));
              if (cb) cb();
            },
          },
        ]}
        onDismiss={() => {
          const cb = modalConfig.onConfirm;
          setModalConfig((prev) => ({ ...prev, visible: false }));
          if (cb) cb();
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
    gap: SPACING.md,
  },
  controlBtn: {
    flex: 1,
  },
  mapOuterWrapper: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  mapContainer: {
    height: 350,
    width: '100%',
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
