import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SunsetBackground } from '../components/SunsetBackground';
import {
  IntakeModal,
  type IntakeData,
  type IntakeLocation,
} from '../components/IntakeModal';
import { ChatInterface } from '../components/ChatInterface';
import { MapInterface } from '../components/MapInterface';
import { colors, fonts, radius } from '../theme';

type ActiveTab = 'chat' | 'map';

export default function HavenScreen() {
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<IntakeLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState('Checking your location...');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isIntakeOpen, setIsIntakeOpen] = useState(true);

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

  const handleCheckShelters = () => {
    if (intake) {
      setActiveTab('chat');
      return;
    }

    setActiveTab('chat');
    setIsIntakeOpen(true);
  };

  return (
    <View style={styles.container}>
      {!intake && isIntakeOpen && <SunsetBackground variant="soft" />}
      {intake ? (
        <View style={styles.experience}>
          <View style={styles.content}>
            {activeTab === 'chat' ? (
              <ChatInterface intake={intake} />
            ) : (
              <MapInterface
                currentLocation={intake.currentLocation ?? currentLocation}
                locationStatus={locationStatus}
                radiusMiles={intake.distance}
                onCheckShelters={handleCheckShelters}
              />
            )}
          </View>
          <View style={styles.bottomBar}>
            <View style={styles.tabSwitch}>
            <Pressable
              onPress={() => setActiveTab('chat')}
              style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
                Chat
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('map')}
              style={[styles.tabButton, activeTab === 'map' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>
                Map
              </Text>
            </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.preview}>
          <SunsetBackground variant="full" style={{ height: 200 }} />
        </View>
      )}
      <IntakeModal
        visible={!intake && isIntakeOpen}
        currentLocation={currentLocation}
        locationStatus={locationStatus}
        onComplete={(data) => {
          setIntake(data);
          setIsIntakeOpen(false);
          setActiveTab('chat');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  experience: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  preview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(228, 221, 208, 0.65)',
  },
  tabSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(239, 233, 221, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.7)',
    padding: 4,
  },
  tabButton: {
    minWidth: 76,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
  },
  tabButtonActive: {
    backgroundColor: colors.foreground,
  },
  tabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.foreground,
  },
  tabTextActive: {
    color: colors.background,
  },
});
