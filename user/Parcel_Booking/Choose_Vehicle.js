

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
} from "react-native"
import { useState, useEffect } from "react"
import { useRoute, useNavigation } from "@react-navigation/native"
import axios from "axios"
import { ChevronLeft, Info, Check } from "lucide-react-native"
import { LinearGradient } from "expo-linear-gradient"

const { width } = Dimensions.get("window")
const isIOS = Platform.OS === "ios"

export default function Choose_Vehicle() {
  const route = useRoute()
  const navigation = useNavigation()
  const { orderDetails } = route.params || {}

  const [vehicles, setVehicles] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fare, setFare] = useState(0)
  const [showInfo, setShowInfo] = useState(null)

  // Get the distance from order details
  const distance = Number.parseFloat(orderDetails?.km_of_ride || 0)

  useEffect(() => {
    fetchVehicles()
  }, [])

  // Calculate fare when vehicle or distance changes
  useEffect(() => {
    if (selectedVehicle && distance) {
      const baseFare = selectedVehicle.BaseFare || 50 // Default base fare if not provided
      const pricePerKm = selectedVehicle.price_per_km || 4
      const calculatedFare = Math.round(baseFare + distance * pricePerKm)
      setFare(calculatedFare)
    }
  }, [selectedVehicle, distance])

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      const response = await axios.get("https://appapi.olyox.com/api/v1/parcel/all-parcel")

      if (response.data.success) {
        // Add BaseFare property to each vehicle
        const vehiclesWithBaseFare = response.data.data.map((vehicle) => ({
          ...vehicle,
          BaseFare: 50, // Default base fare as mentioned in requirements
        }))

        setVehicles(vehiclesWithBaseFare)

        // Select the first vehicle by default
        if (vehiclesWithBaseFare.length > 0) {
          setSelectedVehicle(vehiclesWithBaseFare[0])
        }
      } else {
        setError("Failed to fetch vehicles")
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error)
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle)
    // Vibration feedback
    if (Platform.OS === "ios" || Platform.OS === "android") {
      try {
        const Haptics = require("expo-haptics")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      } catch (e) {
        // Haptics not available
      }
    }
  }

  const handleProceed = () => {
    if (!selectedVehicle) return

    // Update order details with selected vehicle and fare
    const updatedOrderDetails = {
      ...orderDetails,
      vehicle_id: selectedVehicle._id,
      vehicle_info: {
        title: selectedVehicle.title,
        info: selectedVehicle.info,
        image: selectedVehicle.image,
      },
      fares: {
        ...orderDetails?.fares,
        baseFare: selectedVehicle.BaseFare || 50,
        netFare: fare,
        payableAmount: fare,
      },
    }

    // Show success alert
    if (Platform.OS === "ios") {
      Alert.alert("Vehicle Selected", `You've selected ${selectedVehicle.title}. Proceeding to payment.`, [
        { text: "Continue", onPress: () => navigateToPayment(updatedOrderDetails) },
      ])
    } else {
      // Navigate directly on Android
      navigateToPayment(updatedOrderDetails)
    }
  }

  const navigateToPayment = (updatedOrderDetails) => {
    // Navigate to the next screen with updated order details
    navigation.navigate("PaymentScreen", { orderDetails: updatedOrderDetails })
  }

  const toggleInfo = (vehicleId) => {
    setShowInfo(showInfo === vehicleId ? null : vehicleId)
  }

  // Format phone number for display
  const formatPhone = (phone) => {
    return phone ? phone.replace(/(\d{5})(\d{5})/, "$1 $2") : ""
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isIOS ? "dark-content" : "light-content"} backgroundColor="#e53935" />
        <LinearGradient colors={["#e53935", "#d32f2f"]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Vehicle</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e53935" />
          <Text style={styles.loadingText}>Loading available vehicles...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isIOS ? "dark-content" : "light-content"} backgroundColor="#e53935" />
        <LinearGradient colors={["#e53935", "#d32f2f"]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Vehicle</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchVehicles}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isIOS ? "dark-content" : "light-content"} backgroundColor="#e53935" />

      {/* Header */}
      {Platform.OS === 'ios' ? null :(
  <LinearGradient colors={["#e53935", "#d32f2f"]} style={styles.header}>
  <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
    <ChevronLeft size={24} color="#fff" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Select Vehicle</Text>
</LinearGradient>
      )}
    

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Location Card */}
        <View style={styles.locationCard}>
          {/* Sender Info */}
          <View style={styles.locationRow}>
            <View style={styles.locationDot}>
              <View style={styles.greenDot} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>
                {orderDetails?.name || "Sender"} · {formatPhone(orderDetails?.phone)}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {orderDetails?.pickup?.address || ""}
              </Text>
            </View>
          </View>

          {/* Vertical line */}
          <View style={styles.verticalLine} />

          {/* Receiver Info */}
          <View style={styles.locationRow}>
            <View style={styles.locationDot}>
              <View style={styles.redDot} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>
                {orderDetails?.receiver?.name || "Receiver"} · {formatPhone(orderDetails?.receiver?.phone)}
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {orderDetails?.receiver?.apartment && `${orderDetails.receiver.apartment}, `}
                {orderDetails?.dropoff?.address || ''}
              </Text>
            </View>
          </View>
        </View>

       

        {/* Vehicle Options */}
        <View style={styles.vehiclesContainer}>
          {vehicles.map((vehicle) => {
            const isSelected = selectedVehicle?._id === vehicle._id
            const estimatedTime = vehicle.time_can_reach * Math.ceil(distance)

            // Calculate fare for this vehicle
            const vehicleFare = Math.round(vehicle.BaseFare + distance * vehicle.price_per_km)

            return (
              <TouchableOpacity
                key={vehicle._id}
                style={[
                  styles.vehicleCard,
                  isSelected && styles.selectedVehicleCard,
                  isSelected && { height: isSelected ? 80 : 90 },
                ]}
                onPress={() => handleVehicleSelect(vehicle)}
              >
                {isSelected && (
                  <LinearGradient
                    colors={["#ffebee", "#ffcdd2"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}

                <View style={styles.vehicleContent}>
                  <Image source={{ uri: vehicle.image.url }} style={styles.vehicleImage} resizeMode="contain" />

                  <View style={styles.vehicleInfo}>
                    <View style={styles.vehicleHeader}>
                      <Text style={[styles.vehicleTitle, isSelected && styles.selectedText]}>
                        {vehicle.title}
                        {isSelected && (
                          <View style={styles.checkIconContainer}>
                            <Check size={14} color="#e53935" />
                          </View>
                        )}
                      </Text>
                      {vehicle.anyTag && (
                        <View style={styles.tagContainer}>
                          <Text style={styles.tagText}>NEW</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.infoButton}
                        onPress={() => toggleInfo(vehicle._id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Info size={14} color={isSelected ? "#e53935" : "#999"} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.vehicleSpecs, isSelected && styles.selectedText]}>
                      {vehicle.max_weight} kg • {estimatedTime} mins
                    </Text>

                    {showInfo === vehicle._id && (
                      <Text style={styles.vehicleInfoText}>{vehicle.info || "Standard delivery vehicle"}</Text>
                    )}
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={[styles.priceText, isSelected && styles.selectedPriceText]}>₹{vehicleFare}</Text>
                  </View>
                </View>

                {isSelected && (
                  <View style={styles.dimensionContainer}>
                    <Text style={styles.dimensionText}>40 cm</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* Proceed Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.proceedButton} onPress={handleProceed} disabled={!selectedVehicle}>
          <LinearGradient
            colors={["#e53935", "#c62828"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.proceedButtonText}>Proceed With {selectedVehicle?.title || "Selected Vehicle"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: isIOS ? 0 : 45,
    paddingBottom: 16,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 16,
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  errorText: {
    fontSize: 14,
    color: "#e53935",
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#e53935",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  locationCard: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  locationDot: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 2,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50",
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e53935",
  },
  verticalLine: {
    width: 1,
    height: 16,
    backgroundColor: "#ddd",
    marginLeft: 10,
    marginBottom: 8,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  tripSummary: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tripDetail: {
    flex: 1,
    alignItems: "center",
  },
  tripDetailLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  tripDetailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  tripDetailDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "#eee",
    alignSelf: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  vehiclesContainer: {
    marginHorizontal: 16,
    marginBottom: 100, // Space for the bottom button
  },
  vehicleCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    height: 90,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
    borderWidth: 1,
    borderColor: "#eee",
  },
  selectedVehicleCard: {
    borderColor: "#e53935",
    borderWidth: 1.5,
  },
  vehicleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleImage: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  vehicleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  selectedText: {
    color: "#e53935",
    fontWeight: "700",
  },
  checkIconContainer: {
    marginLeft: 4,
  },
  infoButton: {
    marginLeft: 6,
    padding: 2,
  },
  vehicleSpecs: {
    fontSize: 12,
    color: "#666",
  },
  vehicleInfoText: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
    fontStyle: "italic",
  },
  tagContainer: {
    backgroundColor: "#ff7043",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  tagText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  priceContainer: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  selectedPriceText: {
    color: "#e53935",
    fontSize: 18,
  },
  dimensionContainer: {
    position: "absolute",
    top: 8,
    right: 12,
  },
  dimensionText: {
    fontSize: 12,
    color: "#e53935",
    fontWeight: "500",
  },
  bottomContainer: {
    position: "absolute",
    bottom: Platform.OS === 'ios' ? 40:0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  proceedButton: {
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  proceedButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
})
