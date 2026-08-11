import { StyleSheet, Text, View } from 'react-native';
import { useScannerPipeline } from '../hooks/useScannerPipeline';
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
    default:
      // Placeholder — replaced by real screens in Tasks 11–13.
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
