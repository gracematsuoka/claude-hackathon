import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { SunsetBackground } from '../components/SunsetBackground';
import {
  IntakeModal,
  type IntakeData,
  type IntakeLocation,
} from '../components/IntakeModal';
import { ChatInterface } from '../components/ChatInterface';
import { colors } from '../theme';

export default function HavenScreen() {
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<IntakeLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState('Checking your location...');

  useEffect(() => {
    let isMounted = true;

    const requestCurrentLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!isMounted) {
          return;
        }

        if (permission.status !== 'granted') {
          setLocationStatus('Location access was denied. You can still continue without it.');
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) {
          return;
        }

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        let label = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

        const placemarks = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (!isMounted) {
          return;
        }

        const place = placemarks[0];
        if (place) {
          const formatted = [place.city, place.region].filter(Boolean).join(', ');
          if (formatted) {
            label = formatted;
          }
        }

        setCurrentLocation({ latitude, longitude, label });
        setLocationStatus(`Using ${label}`);
      } catch (_error) {
        if (isMounted) {
          setLocationStatus('We could not get your location right now. You can still continue.');
        }
      }
    };

    void requestCurrentLocation();

    return () => {
      isMounted = false;
    };
  }, []);

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
      <IntakeModal
        visible={!intake}
        currentLocation={currentLocation}
        locationStatus={locationStatus}
        onComplete={setIntake}
      />
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
