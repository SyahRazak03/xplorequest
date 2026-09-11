import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Polygon,
  Marker,
  Circle,
  type Region,
  type LatLng,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { mockCheckpoints, Checkpoint, CheckpointStatus } from '../mockData';
import { getThemeForRole, COLORS, SPACING, RADIUS, SHADOWS } from '../theme';
import { ClueBottomSheet } from '../components/ClueBottomSheet';
import { useApp } from '../AppContext';

const { width } = Dimensions.get('window');

// Default initial camera centered on Taman Tasik Titiwangsa
const INITIAL_REGION: Region = {
  latitude: 3.1764,
  longitude: 101.7061,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// Default event boundary polygon (real GPS vertices)
const DEFAULT_BOUNDARY_POLYGON: LatLng[] = [
  { latitude: 3.1795, longitude: 101.7035 },
  { latitude: 3.1802, longitude: 101.7085 },
  { latitude: 3.1765, longitude: 101.7115 },
  { latitude: 3.1725, longitude: 101.7080 },
  { latitude: 3.1740, longitude: 101.7025 },
];

interface MapScreenProps {
  completedCps: string[];
  skippedCps: string[];
  currentCpId: string;
  points: number;
  onPressScan: () => void;
  onPressDetail: (checkpoint: Checkpoint) => void;
  getCheckpointStatus: (cpId: string) => CheckpointStatus;
  setCurrentCpId: React.Dispatch<React.SetStateAction<string>>;
  setCompletedCps: React.Dispatch<React.SetStateAction<string[]>>;
  setPoints: React.Dispatch<React.SetStateAction<number>>;
}

// ── Geodesic & Geometry Helpers ────────────────────────────────────────────────

/** Calculates distance between two coordinates in meters (Haversine formula) */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/** Ray casting point-in-polygon containment check */
function isCoordInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return true;
  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.longitude;
    const yi = polygon[i]!.latitude;
    const xj = polygon[j]!.longitude;
    const yj = polygon[j]!.latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function MapScreen({
  completedCps,
  skippedCps,
  currentCpId,
  points,
  onPressScan,
  onPressDetail,
  getCheckpointStatus,
  setCurrentCpId,
  setCompletedCps,
  setPoints,
}: MapScreenProps) {
  const theme = getThemeForRole('participant');
  const { checkpoints } = useApp();
  const activeCheckpointsList =
    checkpoints.length > 0 ? checkpoints : mockCheckpoints;

  const mapRef = useRef<MapView>(null);

  // Device GPS Location states
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    'granted' | 'denied' | 'undetermined'
  >('undetermined');

  // UI Feedback states
  const [isInsideGeofence, setIsInsideGeofence] = useState(true);
  const [activeArrival, setActiveArrival] = useState(false);
  const [distanceToActive, setDistanceToActive] = useState<number | null>(null);

  // Selected checkpoint details sheet
  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<Checkpoint | null>(null);
  const [selectedCpIndex, setSelectedCpIndex] = useState<number>(0);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Pulse animation for active checkpoint pin
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Request location permission & start live GPS tracking
  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;

    async function startLocationTracking() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermission('denied');
          // Fallback location near Lake Titiwangsa
          setUserLocation({ latitude: 3.1764, longitude: 101.7061 });
          return;
        }

        setLocationPermission('granted');
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const currentCoord: LatLng = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
        };
        setUserLocation(currentCoord);

        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 3,
          },
          (loc) => {
            const coord: LatLng = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setUserLocation(coord);
          }
        );
      } catch {
        setLocationPermission('denied');
        setUserLocation({ latitude: 3.1764, longitude: 101.7061 });
      }
    }

    startLocationTracking();

    return () => {
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, []);

  // Re-calculate proximity and boundary containment on location / checkpoint change
  useEffect(() => {
    if (!userLocation) return;

    // Check geofence boundary containment
    const inside = isCoordInsidePolygon(userLocation, DEFAULT_BOUNDARY_POLYGON);
    setIsInsideGeofence(inside);

    // Find current active checkpoint
    const activeCp = activeCheckpointsList.find((cp) => cp.id === currentCpId);
    if (
      activeCp &&
      typeof activeCp.latitude === 'number' &&
      typeof activeCp.longitude === 'number'
    ) {
      const dist = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        activeCp.latitude,
        activeCp.longitude
      );
      setDistanceToActive(Math.round(dist));

      const radius = activeCp.geofenceRadiusMeters || 50;
      setActiveArrival(dist <= radius);
    } else {
      setActiveArrival(false);
      setDistanceToActive(null);
    }
  }, [userLocation, currentCpId, activeCheckpointsList]);

  const handleMarkerPress = (checkpoint: Checkpoint, idx: number) => {
    setSelectedCheckpoint(checkpoint);
    setSelectedCpIndex(idx);
    setSheetVisible(true);
  };

  const handleRecenter = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        600
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner Status Bar */}
      <View style={styles.bannerRow}>
        {locationPermission === 'denied' ? (
          <View style={[styles.statusBanner, { backgroundColor: COLORS.pending }]}>
            <Ionicons name="location-outline" size={16} color="#FFFFFF" />
            <Text style={styles.bannerText}>GPS DIMATIKAN — DAYAKAN LOKASI UNTUK NAVIGASI LANGSUNG</Text>
          </View>
        ) : !isInsideGeofence ? (
          <View style={[styles.statusBanner, { backgroundColor: COLORS.danger }]}>
            <Ionicons name="warning" size={16} color="#FFFFFF" />
            <Text style={styles.bannerText}>KELUAR GEOFENCE ACARA ⚠️</Text>
          </View>
        ) : activeArrival ? (
          <View style={[styles.statusBanner, { backgroundColor: COLORS.success }]}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.bannerText}>ZON CHECKPOINT AKTIF DIKESAN 📍</Text>
          </View>
        ) : (
          <View style={[styles.statusBanner, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="navigate" size={16} color="#FFFFFF" />
            <Text style={styles.bannerText}>
              Navigasi Laluan GPS {distanceToActive !== null ? `(${distanceToActive}m ke pos)` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Real Google Maps Container */}
      <View
        style={[
          styles.mapContainer,
          { borderColor: theme.colors.border, borderRadius: theme.radius.md },
        ]}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={INITIAL_REGION}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
        >
          {/* Event Geofence Boundary Polygon Overlay */}
          <Polygon
            coordinates={DEFAULT_BOUNDARY_POLYGON}
            fillColor="rgba(224, 106, 36, 0.12)"
            strokeColor={isInsideGeofence ? theme.colors.accent : COLORS.danger}
            strokeWidth={2.5}
            lineDashPattern={[6, 4]}
          />

          {/* Checkpoint Markers Overlay (Role-Projected) */}
          {activeCheckpointsList.map((cp, idx) => {
            // Respect Security Layer 4: skip rendering markers if coordinates are omitted
            if (
              typeof cp.latitude !== 'number' ||
              typeof cp.longitude !== 'number'
            ) {
              return null;
            }

            const cpStatus = getCheckpointStatus(cp.id);
            const isCompleted = cpStatus === 'completed';
            const isSkipped = cpStatus === 'pending';
            const isActive = cpStatus === 'active';

            // Hide checkpoint if configured as hidden and not active/completed
            if (cp.isHiddenInMap && !isCompleted && !isActive) {
              return null;
            }

            let pinBg = '#94A3B8'; // locked gray
            let iconName: 'lock-closed' | 'flag' | 'checkmark' | 'alert' =
              'lock-closed';

            if (isCompleted) {
              pinBg = COLORS.success;
              iconName = 'checkmark';
            } else if (isSkipped) {
              pinBg = COLORS.pending;
              iconName = 'alert';
            } else if (isActive) {
              pinBg = theme.colors.primary;
              iconName = 'flag';
            }

            return (
              <React.Fragment key={cp.id}>
                {/* Geofence Detection Radius Circle for Active Checkpoint */}
                {isActive && (
                  <Circle
                    center={{ latitude: cp.latitude, longitude: cp.longitude }}
                    radius={cp.geofenceRadiusMeters || 50}
                    fillColor="rgba(28, 46, 36, 0.15)"
                    strokeColor={theme.colors.primary}
                    strokeWidth={1.5}
                  />
                )}

                <Marker
                  coordinate={{
                    latitude: cp.latitude,
                    longitude: cp.longitude,
                  }}
                  onPress={() => handleMarkerPress(cp, idx)}
                  anchor={{ x: 0.5, y: 0.8 }}
                >
                  <View style={styles.markerWrapper}>
                    {isActive && (
                      <Animated.View
                        style={[
                          styles.markerPulseRing,
                          {
                            borderColor: theme.colors.primary,
                            transform: [{ scale: pulseAnim }],
                          },
                        ]}
                      />
                    )}

                    <View style={[styles.pinCircle, { backgroundColor: pinBg }]}>
                      <Ionicons name={iconName} size={11} color="#FFFFFF" />
                    </View>

                    <View style={styles.pinLabel}>
                      <Text style={styles.pinLabelText}>CP {idx + 1}</Text>
                    </View>
                  </View>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* User Location Simulated Marker (if standalone/testing) */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              title="Pasukan Anda"
            >
              <View style={styles.userLocationMarker}>
                <View
                  style={[
                    styles.userMarkerPin,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  <Ionicons
                    name="navigate"
                    size={14}
                    color="#FFFFFF"
                    style={styles.navIcon}
                  />
                </View>
                <View style={styles.userBadge}>
                  <Text style={styles.userBadgeText}>Pasukan Anda</Text>
                </View>
              </View>
            </Marker>
          )}
        </MapView>

        {/* Recenter GPS Floating Button */}
        {userLocation && (
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Action Cards */}
      <View style={styles.bottomCardContainer}>
        {activeArrival ? (
          <View
            style={[
              styles.infoCard,
              { borderColor: COLORS.success, borderWidth: 1 },
            ]}
          >
            <View style={styles.infoCardHeader}>
              <View style={styles.arrivalBadge}>
                <Text style={styles.arrivalBadgeText}>SAMPAI DI ZON 📍</Text>
              </View>
              <Text style={[styles.infoCardTitle, { color: theme.colors.text }]}>
                {activeCheckpointsList.find((c) => c.id === currentCpId)?.name}
              </Text>
            </View>
            <Text
              style={[styles.infoCardDesc, { color: theme.colors.textMuted }]}
            >
              Anda berada di lingkungan geofencing pos kawalan aktif. Sila imbas
              kod QR Marshal untuk menuntut mata.
            </Text>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={onPressScan}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Imbas Kod QR Pos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={theme.colors.textMuted}
              />
              <Text style={[styles.infoCardTitle, { color: theme.colors.text }]}>
                Acara Berjalan: CP{' '}
                {activeCheckpointsList.findIndex((c) => c.id === currentCpId) + 1}{' '}
                Aktif
              </Text>
            </View>
            <Text
              style={[styles.infoCardDesc, { color: theme.colors.textMuted }]}
            >
              Navigasi ke pos kawalan aktif berpandukan peta GPS Google di atas.
              {distanceToActive !== null
                ? ` Jarak semasa: lebih kurang ${distanceToActive} meter.`
                : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Map Legend Row */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: COLORS.success }]}
          />
          <Text style={styles.legendLabel}>Selesai</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: theme.colors.primary }]}
          />
          <Text style={styles.legendLabel}>Semasa</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: COLORS.pending }]}
          />
          <Text style={styles.legendLabel}>Dilangkau</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
          <Text style={styles.legendLabel}>Terkunci</Text>
        </View>
      </View>

      {/* The Sheet Modal details viewer */}
      <ClueBottomSheet
        visible={sheetVisible}
        checkpoint={selectedCheckpoint}
        status={
          selectedCheckpoint
            ? getCheckpointStatus(selectedCheckpoint.id)
            : 'locked'
        }
        index={selectedCpIndex}
        onClose={() => setSheetVisible(false)}
        onPressScan={onPressScan}
        onPressDetail={() =>
          selectedCheckpoint && onPressDetail(selectedCheckpoint)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.xs,
  },
  bannerRow: {
    marginBottom: 8,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    gap: 6,
    ...SHADOWS.sm,
  },
  bannerText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  mapContainer: {
    height: 380,
    backgroundColor: '#FAF9F6',
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.md,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  pinCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  pinLabel: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: RADIUS.xs,
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: '#E2E8E4',
    ...SHADOWS.sm,
  },
  pinLabelText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#1C2E24',
  },
  userLocationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.md,
  },
  navIcon: {
    transform: [{ rotate: '45deg' }],
  },
  userBadge: {
    backgroundColor: '#1C2E24',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.xs,
    marginTop: 3,
    ...SHADOWS.sm,
  },
  userBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  bottomCardContainer: {
    marginTop: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 12,
    ...SHADOWS.sm,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  arrivalBadge: {
    backgroundColor: COLORS.success,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.xs,
  },
  arrivalBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  infoCardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    gap: 8,
    marginTop: 10,
    ...SHADOWS.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C6E64',
  },
});
