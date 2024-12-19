import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import KaraokePlayer from './src/components/KaraokePlayer';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5FCFF" />
      <KaraokePlayer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
});

export default App;
