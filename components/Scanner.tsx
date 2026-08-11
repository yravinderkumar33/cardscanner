import { StyleSheet, Text, View } from 'react-native';
import { useScannerPipeline } from '../hooks/useScannerPipeline';
import { CaptureScreen } from './CaptureScreen';
import { ModelLoadingScreen } from './ModelLoadingScreen';

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
});
