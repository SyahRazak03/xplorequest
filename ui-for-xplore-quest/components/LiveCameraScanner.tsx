import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../theme';

interface LiveCameraScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  subtitle?: string;
}

export const LiveCameraScanner: React.FC<LiveCameraScannerProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Imbas Kod QR',
  subtitle = 'Halakan kamera ke Kod QR penanda / pos kawalan',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!visible) return null;

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    onScan(result.data);
    setTimeout(() => {
      setScanned(false);
    }, 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Overlay */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {/* Camera Viewport or Permission Request */}
        {!permission ? (
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color={COLORS.participant.primary} />
            <Text style={styles.permissionText}>Memuatkan kebenaran kamera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.permissionText}>Kebenaran kamera diperlukan untuk mengimbas Kod QR.</Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Benarkan Kamera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          >
            {/* Viewfinder Target Frame */}
            <View style={styles.overlayContainer}>
              <View style={styles.finderBox}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              {scanned && (
                <View style={styles.scannedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                  <Text style={styles.scannedText}>Kod QR Berjaya Diimbas!</Text>
                </View>
              )}
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  permissionBtn: {
    backgroundColor: COLORS.participant.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: RADIUS.md,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  finderBox: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    gap: 8,
    marginTop: SPACING.lg,
  },
  scannedText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
  },
});
