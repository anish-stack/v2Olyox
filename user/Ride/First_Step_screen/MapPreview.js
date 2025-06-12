"use client"

import { useRef, useEffect } from "react"
import { View, Text, TouchableOpacity, Platform } from "react-native"
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Polyline } from "react-native-maps"
import MapViewDirections from "react-native-maps-directions"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import styles from "./Styles"
import { mapStyle, GOOGLE_MAPS_APIKEY } from "./constants"

const MapPreview = ({ rideData, coordinates, region, setRegion }) => {

  const mapRef = useRef(null)
  const isAndroid = Platform.OS === "android"

  useEffect(() => {
    fitMapToMarkers()
  }, [rideData.pickup.latitude, rideData.dropoff.latitude])

  const fitMapToMarkers = () => {
    if (!mapRef.current || !rideData.pickup.latitude) return

    // If both pickup and dropoff are set
    if (rideData.dropoff.latitude) {
      mapRef.current.fitToCoordinates(
        [
          {
            latitude: rideData.pickup.latitude,
            longitude: rideData.pickup.longitude,
          },
          {
            latitude: rideData.dropoff.latitude,
            longitude: rideData.dropoff.longitude,
          },
        ],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        },
      )
    } else {
      // If only pickup is set
      mapRef.current.animateToRegion(
        {
          latitude: rideData.pickup.latitude,
          longitude: rideData.pickup.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      )
    }
  }

  return (
    <View style={styles.previewMapContainer}>
      <MapView
        ref={mapRef}
        provider={isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={styles.previewMap}
        initialRegion={{
          latitude: rideData.pickup.latitude,
          longitude: rideData.pickup.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        customMapStyle={mapStyle}
        showsUserLocation
        showsCompass={true}
        showsMyLocationButton={true}
        minZoomLevel={5}
        maxZoomLevel={18}
      >
        {/* Pickup marker */}
        <Marker
          coordinate={{
            latitude: rideData.pickup.latitude,
            longitude: rideData.pickup.longitude,
          }}
          title="Pickup"
          description={rideData.pickup.description}
        >
          <View style={styles.customMarker}>
            <Icon name="circle" size={12} color="#35C14F" />
          </View>
        </Marker>

        {/* Dropoff marker (if exists) */}
        {rideData?.dropoff?.latitude && (
          <Marker
            coordinate={{
              latitude: rideData.dropoff.latitude,
              longitude: rideData.dropoff.longitude,
            }}
            title="Drop-off"
            description={rideData.dropoff.description}
          >
            <View style={styles.customMarker}>
              <Icon name="square" size={12} color="#D93A2D" />
            </View>
          </Marker>
        )}

        {/* Directions (Android only and if dropoff exists) */}
        {isAndroid && rideData?.dropoff?.latitude && (
          <MapViewDirections
            origin={{
              latitude: rideData.pickup.latitude,
              longitude: rideData.pickup.longitude,
            }}
            destination={{
              latitude: rideData.dropoff.latitude,
              longitude: rideData.dropoff.longitude,
            }}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#000000"
            mode="DRIVING"
            onError={(errorMessage) => {
              console.warn("MapViewDirections Error:", errorMessage)
            }}
          />
        )}

        {/* Polyline fallback for iOS (if coordinates exist) */}
        {!isAndroid && coordinates.length > 0 && (
          <Polyline coordinates={coordinates} strokeWidth={4} strokeColor="#000000" />
        )}
      </MapView>

      <TouchableOpacity style={styles.recenterButton} onPress={fitMapToMarkers}>
        <Icon name="crosshairs" size={24} color="#000" />
      </TouchableOpacity>

      <View style={styles.mapOverlayInfo}>
        <View style={styles.mapInfoItem}>
          <Icon name="circle" size={10} color="#35C14F" />
          <Text numberOfLines={1} style={styles.mapInfoText}>
            {rideData.pickup.description}
          </Text>
        </View>

        {rideData?.dropoff?.latitude && (
          <>
            <View style={styles.mapInfoDivider} />
            <View style={styles.mapInfoItem}>
              <Icon name="square" size={10} color="#D93A2D" />
              <Text numberOfLines={1} style={styles.mapInfoText}>
                {rideData.dropoff.description}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

export default MapPreview
