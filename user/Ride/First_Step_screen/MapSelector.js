import { View, Text, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import { Platform } from "react-native"
import styles from "./Styles"
import { mapStyle } from "./constants"

const MapSelector = ({ region, mapType, address, loading, onRegionChangeComplete, onBack }) => {
  const isAndroid = Platform.OS === "android"
  const isIOS = Platform.OS === "ios"

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Icon name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.mapHeaderTitle}>Select {mapType === "pickup" ? "Pickup" : "Drop-off"} Location</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          provider={isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          style={styles.map}
          region={{
            latitude: region?.latitude || 28.7041,
            longitude: region?.longitude || 77.1025,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          customMapStyle={mapStyle}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton
          showsCompass
          minZoomLevel={5}
          maxZoomLevel={18}
          {...(isIOS && {
            showsTraffic: true,
          })}
        >
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            pinColor={mapType === "pickup" ? "green" : "red"}
            opacity={1}
          />
        </MapView>

        {/* Custom centered marker */}
        <View style={styles.centerMarker}>
          <View style={styles.markerShadow} />
          <Icon name="map-marker" size={40} color={mapType === "pickup" ? "#35C14F" : "#D93A2D"} />
        </View>
      </View>

      <View style={styles.mapFooter}>
        <Text numberOfLines={2} style={styles.mapAddressText}>
          {address || "Move map to select location"}
        </Text>
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: mapType === "pickup" ? "#35C14F" : "#D93A2D" }]}
          onPress={onBack}
        >
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

export default MapSelector
