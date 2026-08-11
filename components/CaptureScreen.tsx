import { useRef, useState } from 'react';
import { Button, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export function CaptureScreen({ onImage, banner }: { onImage(uri: string): void; banner: string | null }) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) onImage(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]?.uri) onImage(result.assets[0].uri);
  };

  if (!permission) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      {banner != null && <Text style={styles.banner}>{banner}</Text>}
      {permission.granted ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" onCameraReady={() => setCameraReady(true)} />
      ) : (
        <View style={styles.denied}>
          <Text style={styles.deniedText}>Camera access is needed to photograph cards.</Text>
          {permission.canAskAgain ? (
            <Button title="Allow camera" onPress={requestPermission} />
          ) : (
            <Button title="Open Settings" onPress={() => Linking.openSettings()} />
          )}
          <Text style={styles.deniedHint}>You can still pick a card photo from your gallery below.</Text>
        </View>
      )}
      <View style={styles.controls}>
        <Button title="Gallery" onPress={pickFromGallery} />
        <TouchableOpacity
          style={[styles.shutter, (!permission.granted || !cameraReady || busy) && styles.shutterDisabled]}
          onPress={takePhoto}
          disabled={!permission.granted || !cameraReady || busy}
        />
        <View style={styles.controlSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  banner: { backgroundColor: '#fef3c7', color: '#92400e', padding: 10, textAlign: 'center' },
  camera: { flex: 1 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  deniedText: { fontSize: 16, textAlign: 'center', marginBottom: 12 },
  deniedHint: { fontSize: 13, color: '#666', marginTop: 12, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, backgroundColor: '#111' },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', borderWidth: 4, borderColor: '#bbb' },
  shutterDisabled: { opacity: 0.4 },
  controlSpacer: { width: 60 },
});
