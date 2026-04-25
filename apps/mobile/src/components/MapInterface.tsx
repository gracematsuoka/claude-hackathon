import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, shadow } from '../theme';
import type { IntakeLocation } from './IntakeModal';

interface ShelterMarker {
  name: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  phoneNumber: string | null;
  markerStatus: 'missing' | 'stale' | 'fresh';
  markerStatusLabel?: 'Up to date' | 'Updated >1 hr ago' | 'No data';
  markerColor: string;
  backendLocation: {
    id: string | null;
    name: string | null;
    address: string | null;
    phone: string | null;
    updated_at: string | null;
    last_called: string | null;
    space_available: number | boolean | null;
  } | null;
}

interface Props {
  currentLocation: IntakeLocation | null;
  locationStatus: string;
  radiusMiles: number;
  onCheckShelters: () => void;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const LOCALHOST_HINT =
  API_URL.includes('localhost') || API_URL.includes('127.0.0.1')
    ? ` The app is currently using ${API_URL}. If you're on a physical phone, replace localhost with your Mac's local network IP in apps/mobile/.env and restart Expo.`
    : '';

function formatStatusLabel(status: ShelterMarker['markerStatus']) {
  if (status === 'fresh') return 'Up to date';
  if (status === 'stale') return 'Updated >1 hr ago';
  return 'No data';
}

function formatAvailability(value: number | boolean | null | undefined) {
  if (typeof value === 'number') {
    if (value < 0) {
      return 'Unknown';
    }

    if (value === 1) {
      return '1 slot';
    }

    return `${value} slots`;
  }

  if (value === true) {
    return '1 slot';
  }

  if (value === false) {
    return '0 slots';
  }

  return 'Unknown';
}

function buildMapHtml({
  latitude,
  longitude,
  token,
  markers,
}: {
  latitude: number;
  longitude: number;
  token: string;
  markers: ShelterMarker[];
}) {
  const serializedMarkers = JSON.stringify(
    markers
      .filter((marker) => marker.latitude != null && marker.longitude != null)
      .map((marker) => ({
        ...marker,
        markerStatusLabel: marker.markerStatusLabel || formatStatusLabel(marker.markerStatus),
        availabilityLabel: formatAvailability(
          marker.backendLocation ? marker.backendLocation.space_available : null,
        ),
      })),
  );

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.css" rel="stylesheet" />
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.js"></script>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #faf7f2; }
      #map { position: absolute; inset: 0; }
      .user-marker {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: linear-gradient(180deg, #f77b3d 0%, #ffb85c 100%);
        border: 3px solid rgba(255, 255, 255, 0.92);
        box-shadow: 0 10px 22px rgba(42, 36, 56, 0.24);
      }
      .shelter-marker {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.92);
        box-shadow: 0 8px 16px rgba(42, 36, 56, 0.18);
      }
      .mapboxgl-popup-content {
        border-radius: 16px;
        padding: 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #2a2438;
        max-width: 250px;
        box-shadow: 0 14px 28px rgba(42, 36, 56, 0.18);
      }
      .popup-card {
        padding: 12px 12px 10px;
        background: #fffdf9;
      }
      .popup-title {
        margin: 0 0 8px;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.3;
      }
      .popup-section {
        display: grid;
        gap: 8px;
      }
      .popup-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .popup-label {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #6b6580;
        text-transform: uppercase;
      }
      .popup-value {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
        color: #2a2438;
        text-align: right;
        flex: 1;
      }
      .popup-address {
        margin: 10px 0 0;
        padding-top: 10px;
        border-top: 1px solid rgba(228, 221, 208, 0.7);
        font-size: 12px;
        line-height: 1.45;
        color: #6b6580;
      }
      .mapboxgl-popup-close-button {
        font-size: 16px;
        color: #6b6580;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      mapboxgl.accessToken = ${JSON.stringify(token)};

      const markers = ${serializedMarkers};
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/standard',
        center: [${longitude}, ${latitude}],
        zoom: 12.8,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([${longitude}, ${latitude}]);

      const userMarkerElement = document.createElement('div');
      userMarkerElement.className = 'user-marker';

      new mapboxgl.Marker({ element: userMarkerElement, anchor: 'center' })
        .setLngLat([${longitude}, ${latitude}])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText('Your current location'))
        .addTo(map);

      markers.forEach((marker) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'shelter-marker';
        markerElement.style.backgroundColor = marker.markerColor;

        const popupHtml = [
          '<div class="popup-card">',
          '<p class="popup-title">' + (marker.name || 'Shelter') + '</p>',
          '<div class="popup-section">',
          '<div class="popup-row"><p class="popup-label">Status</p><p class="popup-value">' + marker.markerStatusLabel + '</p></div>',
          '<div class="popup-row"><p class="popup-label">Space</p><p class="popup-value">' + marker.availabilityLabel + '</p></div>',
          marker.backendLocation && marker.backendLocation.updated_at
            ? '<div class="popup-row"><p class="popup-label">Updated</p><p class="popup-value">' + new Date(marker.backendLocation.updated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</p></div>'
            : '',
          marker.phoneNumber || (marker.backendLocation && marker.backendLocation.phone)
            ? '<div class="popup-row"><p class="popup-label">Phone</p><p class="popup-value">' + (marker.backendLocation?.phone || marker.phoneNumber) + '</p></div>'
            : '',
          '</div>',
          marker.address ? '<p class="popup-address">' + marker.address + '</p>' : '',
          '</div>',
        ].join('');

        new mapboxgl.Marker({ element: markerElement, anchor: 'center' })
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml))
          .addTo(map);

        bounds.extend([marker.longitude, marker.latitude]);
      });

      if (markers.length) {
        map.fitBounds(bounds, { padding: 56, maxZoom: 13.8 });
      }
    </script>
  </body>
</html>`;
}

export const MapInterface = ({
  currentLocation,
  locationStatus,
  radiusMiles,
  onCheckShelters,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [markers, setMarkers] = useState<ShelterMarker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const staleOrMissingCount = markers.filter(
    (marker) => marker.markerStatus === 'stale' || marker.markerStatus === 'missing',
  ).length;
  const shouldShowOutdatedBanner =
    markers.length >= 3 && staleOrMissingCount / markers.length >= 0.5;

  useEffect(() => {
    if (!currentLocation) {
      setMarkers([]);
      return;
    }

    let isMounted = true;
    const radiusMeters = Math.max(1609, Math.round(radiusMiles * 1609.34));

    const loadShelters = async () => {
      setIsLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          latitude: String(currentLocation.latitude),
          longitude: String(currentLocation.longitude),
          radius: String(radiusMeters),
        });

        const response = await fetch(`${API_URL}/api/locations/shelters/nearby?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load nearby shelters.');
        }

        if (isMounted) {
          setMarkers(Array.isArray(payload.results) ? payload.results : []);
        }
      } catch (fetchError) {
        if (isMounted) {
          setMarkers([]);
          setError(
            fetchError instanceof Error
              ? `${fetchError.message} (${API_URL}).${LOCALHOST_HINT}`
              : 'Failed to load nearby shelters.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadShelters();

    return () => {
      isMounted = false;
    };
  }, [currentLocation, radiusMiles]);

  const mapHtml = useMemo(() => {
    if (!currentLocation || !MAPBOX_TOKEN) {
      return null;
    }

    return buildMapHtml({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      token: MAPBOX_TOKEN,
      markers,
    });
  }, [currentLocation, markers]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['#A8B8F0', '#E8B898', '#FCD68C'] as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerOrb}
          />
          <View>
            <Text style={styles.headerTitle}>Nearby Shelters</Text>
            <Text style={styles.headerMeta}>
              {currentLocation ? `${currentLocation.label} · ${markers.length} found` : locationStatus}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.mapFrame}>
        {mapHtml ? (
          <>
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.map}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              overScrollMode="never"
              mixedContentMode="always"
            />
            {isLoading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={colors.foreground} />
                <Text style={styles.loadingText}>Loading nearby shelters...</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {!MAPBOX_TOKEN ? 'Mapbox token missing' : 'Location unavailable'}
            </Text>
            <Text style={styles.emptyText}>
              {!MAPBOX_TOKEN
                ? 'Add EXPO_PUBLIC_MAPBOX_TOKEN to apps/mobile/.env so the map can render.'
                : locationStatus}
            </Text>
          </View>
        )}
      </View>

      {shouldShowOutdatedBanner ? (
        <Pressable style={styles.alertBanner} onPress={onCheckShelters}>
          <View style={styles.alertCopy}>
            <Text style={styles.alertText}>Info may be outdated in this area </Text>
            <Text style={[styles.alertText, styles.alertActionText]}>Check shelter availability</Text>
          </View>
          <Text style={styles.alertArrow}>→</Text>
        </Pressable>
      ) : null}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
          <Text style={styles.legendText}>{formatStatusLabel('missing')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F4B942' }]} />
          <Text style={styles.legendText}>{formatStatusLabel('stale')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>{formatStatusLabel('fresh')}</Text>
        </View>
      </View>

      <View style={styles.caption}>
        <Text style={[styles.captionText, error ? styles.captionError : null]}>
          {error || `Showing Google Places shelters within ${radiusMiles} miles.`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228, 221, 208, 0.5)',
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerOrb: {
    height: 32,
    width: 32,
    borderRadius: 999,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.foreground,
  },
  headerMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.mutedForeground,
    letterSpacing: 0.3,
  },
  mapFrame: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.7)',
    backgroundColor: colors.card,
    ...shadow.soft,
  },
  map: {
    flex: 1,
    backgroundColor: colors.card,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loadingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.foreground,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 185, 66, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244, 185, 66, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  alertCopy: {
    flex: 1,
    gap: 2,
  },
  alertText: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.mutedForeground,
  },
  alertActionText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.foreground,
  },
  alertArrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 18,
    color: colors.foreground,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 233, 221, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  caption: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  captionText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  captionError: {
    color: colors.destructive,
  },
});
