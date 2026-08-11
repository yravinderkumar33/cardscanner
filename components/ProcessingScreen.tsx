import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

export function ProcessingScreen({
  stage,
  streamText,
  onCancel,
}: {
  stage: 'ocr' | 'llm';
  streamText: string;
  onCancel(): void;
}) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.title}>{stage === 'ocr' ? 'Reading the card…' : 'Understanding the details…'}</Text>
      {stage === 'llm' && streamText !== '' && (
        <ScrollView style={styles.stream}>
          <Text style={styles.streamText}>{streamText}</Text>
        </ScrollView>
      )}
      <Button title="Cancel" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, marginVertical: 16 },
  stream: { maxHeight: 160, alignSelf: 'stretch', marginBottom: 16, backgroundColor: '#f4f4f5', borderRadius: 8, padding: 12 },
  streamText: { fontFamily: 'Menlo', fontSize: 12, color: '#444' },
});
