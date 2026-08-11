import { Alert, Button, Linking, StyleSheet, Text, View } from 'react-native';
import { saveToContacts } from '../lib/contacts';
import { useScannerPipeline } from '../hooks/useScannerPipeline';
import { CaptureScreen } from './CaptureScreen';
import { ModelLoadingScreen } from './ModelLoadingScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ReviewScreen } from './ReviewScreen';

export function Scanner({ onRetryModels }: { onRetryModels(): void }) {
  const pipeline = useScannerPipeline();

  switch (pipeline.phase) {
    case 'loading-models':
      return (
        <ModelLoadingScreen
          ocrProgress={pipeline.ocrProgress}
          llmProgress={pipeline.llmProgress}
          error={pipeline.modelError}
          onRetry={onRetryModels}
        />
      );
    case 'capture':
      return <CaptureScreen onImage={(uri) => pipeline.scanCard(uri)} banner={pipeline.scanError} />;
    case 'processing':
      return <ProcessingScreen stage={pipeline.stage} streamText={pipeline.streamText} onCancel={pipeline.cancel} />;
    case 'review':
      return (
        <ReviewScreen
          fields={pipeline.fields}
          rawText={pipeline.rawText}
          degraded={pipeline.degraded}
          onRescan={pipeline.rescan}
          onSave={async (edited) => {
            const result = await saveToContacts(edited);
            if (result === 'denied') {
              Alert.alert(
                'Contacts access needed',
                'Allow contacts access in Settings to save this card. Your edits are kept.',
                [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel' }]
              );
              return; // stay on review — data preserved
            }
            pipeline.finishSave();
          }}
        />
      );
    case 'done':
      return (
        <View style={styles.placeholder}>
          <Text style={styles.doneTitle}>Done!</Text>
          <Text style={styles.doneSub}>Contact handed to iOS.</Text>
          <Button title="Scan another card" onPress={pipeline.reset} />
        </View>
      );
    default:
      // Placeholder — replaced by real screens in Tasks 12–13.
      return (
        <View style={styles.placeholder}>
          <Text>phase: {pipeline.phase}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  doneTitle: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  doneSub: { fontSize: 15, color: '#666', marginBottom: 20 },
});
