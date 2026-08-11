import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Must run before any other react-native-executorch API (module scope = app entry).
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export default function App() {
  return (
    <View style={styles.container}>
      <Text>CardScanner — ExecuTorch initialized</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
