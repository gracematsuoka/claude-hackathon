import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SunsetBackground } from '../components/SunsetBackground';
import { IntakeModal, type IntakeData } from '../components/IntakeModal';
import { ChatInterface } from '../components/ChatInterface';
import { colors } from '../theme';

export default function HavenScreen() {
  const [intake, setIntake] = useState<IntakeData | null>(null);

  return (
    <View style={styles.container}>
      {!intake && <SunsetBackground variant="soft" />}
      {intake ? (
        <ChatInterface intake={intake} />
      ) : (
        <View style={styles.preview}>
          <SunsetBackground variant="full" style={{ height: 200 }} />
        </View>
      )}
      <IntakeModal visible={!intake} onComplete={setIntake} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  preview: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
