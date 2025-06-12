import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_MAPS_APIKEY = 'YOUR_API_KEY_HERE';

export default function Map({ 
  origin = { latitude: 28.6922, longitude: 77.1507 }, 
  destination = { latitude: 28.7011, longitude: 77.1170 } 
}) {
  const [loading, setLoading] = useState(false);

  console.log('Origin:', origin);
  console.log('Destination:', destination);

  return (
    <View style={styles.mapContainer}>
      {loading && (
        <View>
          <ActivityIndicator size="large" color="#23527C" />
        </View>
      )}
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{
          latitude: 28.6922,
          longitude: origin.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        loadingEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
        showsUserLocation={true}
        onMapReady={() => console.log('Map is ready')}
      >
        {/* Markers */}
        <Marker coordinate={origin} title="Pickup">
          <Icon name="nature-people" size={40} color="#23527C" />
        </Marker>
        <Marker coordinate={destination} title="Dropoff">
          <Icon name="map-marker" size={40} color="#F44336" />
        </Marker>

        {/* Directions */}
        {origin && destination && (
          <MapViewDirections
            origin={origin}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF6666"
            onStart={() => {
              setLoading(true);
              console.log('Fetching directions...');
            }}
            onReady={(result) => {
              setLoading(false);
              console.log('Directions ready:', result);
            }}
            onError={(error) => {
              setLoading(false);
              console.error('Directions error:', error);
            }}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 400,
    backgroundColor: '#f0f0f0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
