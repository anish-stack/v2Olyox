import { View, StyleSheet ,Dimensions} from "react-native"
import { Modal, Surface, Text, Button } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
const { height } = Dimensions.get('window')
export default function RideRequestModal({ visible, rideData, timeLeft, onAccept, onReject }) {
  if (!rideData) return null

  const matchedRider = rideData.riders[0] // Assuming the first rider is the matched one

  return (
    <Modal visible={visible} onDismiss={onReject} contentContainerStyle={styles.modalContainer}>
      <Surface style={styles.modalContent}>
        <Text style={styles.modalTitle}>New Ride Request</Text>
        <Text style={styles.timerText}>Time remaining: {Math.ceil(timeLeft / 1000)}s</Text>

        <LocationInfo pickup={rideData.pickup_desc} dropoff={rideData.drop_desc} />
        <RideDetails distance={rideData.distance} duration={rideData.trafficDuration} fare={matchedRider.price} />

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={onAccept}
            style={[styles.actionButton, styles.acceptButton]}
            labelStyle={styles.buttonLabel}
          >
            Accept Ride
          </Button>
          <Button
            mode="outlined"
            onPress={onReject}
            style={[styles.actionButton, styles.rejectButton]}
            labelStyle={[styles.buttonLabel, styles.rejectButtonLabel]}
          >
            Decline
          </Button>
        </View>
      </Surface>
    </Modal>
  )
}

function LocationInfo({ pickup, dropoff }) {
  return (
    <View style={styles.locationContainer}>
      <LocationItem icon="map-marker" color="#EF4444" label="Pickup" description={pickup} />
      <View style={styles.locationDivider} />
      <LocationItem icon="flag-checkered" color="#22C55E" label="Drop-off" description={dropoff} />
    </View>
  )
}

function LocationItem({ icon, color, label, description }) {
  return (
    <View style={styles.locationItem}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <View style={styles.locationText}>
        <Text style={styles.locationLabel}>{label}</Text>
        <Text style={styles.locationDesc}>{description}</Text>
      </View>
    </View>
  )
}

function RideDetails({ distance, duration, fare }) {
  return (
    <View style={styles.detailsGrid}>
      <DetailItem icon="map-marker-distance" label="Distance" value={`${distance} km`} />
      <DetailItem icon="clock-outline" label="Duration" value={`${duration} min`} />
      <DetailItem icon="currency-inr" label="Fare" value={`₹${fare}`} />
    </View>
  )
}

function DetailItem({ icon, label, value }) {
  return (
    <View style={styles.detailItem}>
      <MaterialCommunityIcons name={icon} size={20} color="#6366F1" />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    mapContainer: {
        width: '100%',
        height: height * 0.5,
        overflow: 'hidden',
        borderRadius: 12,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    waitingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    waitingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#4B5563',
        fontWeight: '500',
    },
    markerContainer: {
        padding: 8,
        borderRadius: 20,
        elevation: 4,
    },
    modalContainer: {
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    timerText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: '500',
    },
    locationContainer: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    locationText: {
        marginLeft: 12,
        flex: 1,
    },
    locationLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    locationDesc: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    locationDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    detailsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    detailItem: {
        flex: 1,
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        marginHorizontal: 4,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 8,
    },
    acceptButton: {
        backgroundColor: '#6366F1',
    },
    rejectButton: {
        borderColor: '#EF4444',
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    rejectButtonLabel: {
        color: '#EF4444',
    },

})

