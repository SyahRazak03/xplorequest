import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const VIEWFINDER_SIZE = 260;

interface RealCameraQRScannerProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
}

export default function RealCameraQRScanner({
  visible,
  title = 'Imbas Kod QR',
  subtitle = 'Halakan kamera peranti pada kod QR',
  onClose,
  onScanSuccess,
}: RealCameraQRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!visible) return null;

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanSuccess(data);
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color={COLORS.participant.primary} />
            <Text style={styles.permissionText}>Memuatkan kebenaran kamera...</Text>
          </View>
        ) : !permission.granted ? (
          <SafeAreaView style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.permissionTitle}>Akses Kamera Diperlukan</Text>
            <Text style={styles.permissionSub}>
              Aplikasi memerlukan kebenaran kamera untuk mengimbas kod QR pelepasan mula.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Benarkan Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
              <Text style={styles.cancelLinkText}>Batal</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            {/* Viewfinder Overlay Mask Panels */}
            <View style={styles.maskTop} pointerEvents="none" />
            <View style={styles.maskRow} pointerEvents="none">
              <View style={styles.maskSide} />
              <View style={styles.viewfinder}>
                {/* 4 Corner Brackets */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.maskSide} />
            </View>
            <View style={styles.maskBottom} pointerEvents="none" />

            {/* Foreground UI Overlay */}
            <SafeAreaView style={styles.overlayContent}>
              {/* Header Bar */}
              <View style={styles.headerBar}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                  <Text style={styles.closeText}>Kembali</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 60 }} />
              </View>

              {/* Subtitle Info Box */}
              <View style={styles.infoBox}>
                <Text style={styles.scanTargetTitle}>{title}</Text>
                <Text style={styles.scanTargetSub}>{subtitle}</Text>
              </View>
            </SafeAreaView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  permissionSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
    lineHeight: 18,
  },
  permissionText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  permissionButton: {
    backgroundColor: COLORS.participant.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 14,
  },
  cancelLink: {
    marginTop: SPACING.md,
    padding: SPACING.xs,
  },
  cancelLinkText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  maskTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: (screenHeight - VIEWFINDER_SIZE) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  maskBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: (screenHeight - VIEWFINDER_SIZE) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  maskRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
    position: 'absolute',
    top: (screenHeight - VIEWFINDER_SIZE) / 2,
    left: 0,
    right: 0,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.participant.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: RADIUS.xs,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: RADIUS.xs,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: RADIUS.xs,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: RADIUS.xs,
  },
  overlayContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
    marginTop: 10,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
  },
  closeText: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: 13,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  infoBox: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.12,
    paddingHorizontal: SPACING.md,
  },
  scanTargetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },
  scanTargetSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
