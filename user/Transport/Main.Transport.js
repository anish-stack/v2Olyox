
import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Linking,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from "react-native"
import Layout from "../components/Layout/_layout"
import { useNavigation } from "@react-navigation/native"
import axios from "axios"
import { useLocation } from "../context/LocationContext"
import { Phone, MessageSquare, MapPin, Clock, Search, X, Check, ChevronDown, ChevronUp } from "lucide-react-native"
import { find_me } from "../utils/helpers"

const { width } = Dimensions.get("window")

export default function MainTransport() {
  const navigation = useNavigation()
  const { location } = useLocation()
  const [partners, setPartners] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [messageModalVisible, setMessageModalVisible] = useState(false)
  const [callModalVisible, setCallModalVisible] = useState(false)
  const [thankYouModalVisible, setThankYouModalVisible] = useState(false)
  const [thankYouMessage, setThankYouMessage] = useState("")
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [message, setMessage] = useState("")
  const [expandedServiceAreas, setExpandedServiceAreas] = useState({})
  const scrollViewRef = useRef(null)

  // Fetch vehicle categories from admin API
  const handleFetch = async () => {
    setCategoriesLoading(true)
    try {
      const { data } = await axios.get(`http://192.168.1.6:3100/api/v1/admin/get-heavy`)
      if (data.data) {
        

        // Add "All" category
        const allCategory = {
          _id: "all",
          title: "All Vehicles",
          category: "all",
          active:true,
          backgroundColour: "#E74C3C",
          image: {
            url: "https://i.ibb.co/8nFg7SGc/240-F-315664059-3-U5r-Ifjw-AR5b2r-Il-Jdchwl5-Jsb-E8uljn.jpg",
          },
        }
        const dataCopy = [allCategory, ...data.data]
        const filterData = dataCopy.filter((item)=> item.active === true)
        setVehicles(filterData)
      } else {
        setVehicles([])
        Alert.alert("No Data", "No vehicle categories found")
      }
    } catch (error) {
      console.log("Error fetching categories:", error)
      Alert.alert("Error", "Failed to fetch vehicle categories")
    } finally {
      setCategoriesLoading(false)
    }
  }

  // Fetch partners from API
  const fetchPartners = async () => {
    setPartnersLoading(true)
    try {
      const { data } = await axios.get(
        `http://192.168.1.6:3100/api/v1/heavy/heavy-vehicle-partners?lat=${location?.coords?.latitude || 28.7136
        }&lng=${location?.coords?.longitude || 77.0981}&page=1&limit=10`,
      )

      if (data.partners) {
        setPartners(data.partners)
      } else {
        setPartners([])
        Alert.alert("No Data", "No partners found in your area")
      }
    } catch (error) {
      console.log("Error fetching partners:", error)
      Alert.alert("Error", "Failed to fetch partners")
    } finally {
      setPartnersLoading(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    handleFetch()
    fetchPartners()
  }, [])

  // Toggle expanded service areas
  const toggleServiceAreas = (partnerId) => {
    setExpandedServiceAreas((prev) => ({
      ...prev,
      [partnerId]: !prev[partnerId],
    }))
  }

  // Enhanced search with regex
  const filteredPartners = partners
    .filter((partner) => {
      if (!searchQuery) return true

      const regex = new RegExp(searchQuery, "i")

      // Search in partner name and phone
      const nameMatch = regex.test(partner.name)
      const phoneMatch = regex.test(partner.phone_number)

      // Search in service areas
      const serviceAreaMatch = partner.service_areas.some((area) => regex.test(area.name))

      // Search in vehicle names
      const vehicleMatch = partner.vehicle_info.some((vehicle) => regex.test(vehicle.name))

      return nameMatch || phoneMatch || serviceAreaMatch || vehicleMatch
    })
    .filter((partner) => {
      // Filter by vehicle category
      if (selectedCategory === "all") return true

      // For categories like "truck", match both "truck" and anything containing "truck"
      return partner.vehicle_info.some((v) => {
        // Find the category object that matches this vehicle's categoryId
        const category = vehicles.find((cat) => cat._id === v.categoryId)

        if (!category) return false

        // Check if the vehicle name contains the selected category (case insensitive)
        if (selectedCategory === "truck") {
          return v.name.toLowerCase().includes("truck")
        }

        return category.category === selectedCategory
      })
    })

  // Send message API call
  const sendMessage = async () => {
    if (selectedPartner && message.trim()) {
      const user = await find_me();
      try {

        const response = await axios.post('http://192.168.1.6:3100/api/v1/heavy/generated-call-and-message-request', {
          receiverId: selectedPartner._id,
          message: message,
          senderId: user?.user?._id,
          requestType: 'message'
        })

        console.log("Message sent:", response.data)
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setThankYouMessage(`${response.data.message} ${selectedPartner.name}`)
        setMessageModalVisible(false)
        setThankYouModalVisible(true)
        setMessage("")
      } catch (error) {
        console.log("Error sending message:", error)
        Alert.alert("Error", "Failed to send message")
      }
    } else {
      Alert.alert("Error", "Please enter a message")
    }
  }

  // Make call API call
  const confirmCall = async () => {
    if (selectedPartner) {
      const user = await find_me();
      try {

        const response = await axios.post('http://192.168.1.6:3100/api/v1/heavy/generated-call-and-message-request', {
          receiverId: selectedPartner._id,
          message: message,
          senderId: user?.user?._id,
          requestType: 'call'
        })

        console.log("Message sent:", response.data)
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Open phone dialer
        Linking.openURL(`tel:${selectedPartner.phone_number}`)
        setCallModalVisible(false)
        setThankYouMessage(`Call initiated to ${selectedPartner.name}`)
        setThankYouModalVisible(true)
      } catch (error) {
        console.log("Error logging call:", error)
        Alert.alert("Error", "Failed to initiate call")
      }
    }
  }

  const handleCall = (partner) => {
    setSelectedPartner(partner)
    setCallModalVisible(true)
  }

  const handleMessage = (partner) => {
    setSelectedPartner(partner)
    setMessageModalVisible(true)
  }

  const renderPartnerItem = ({ item }) => {
    // Group vehicles into pairs for two-column layout
    const vehiclePairs = []
    for (let i = 0; i < item.vehicle_info.length; i += 2) {
      vehiclePairs.push(item.vehicle_info.slice(i, i + 2))
    }

    return (
      <View style={styles.partnerCard}>
        <View style={styles.partnerHeader}>
          <View>
            <Text style={styles.partnerName}>{item.name}</Text>
            <Text style={styles.partnerId}>ID: {item.Bh_Id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.is_working ? "#4CAF50" : "#E74C3C" }]}>
            <Text style={styles.statusText}>{item.is_working ? "Available" : "Busy"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Available Vehicles</Text>
        <View style={styles.vehicleGrid}>
          {vehiclePairs.map((pair, index) => (
            <View key={index} style={styles.vehicleRow}>
              {pair.map((vehicle) => {
                // Find the category for this vehicle
                const vehicleCategory = vehicles.find((cat) => cat._id === vehicle.categoryId)
                const categoryColor = vehicleCategory ? vehicleCategory.backgroundColour : "#E74C3C"

                return (
                  <View key={vehicle._id} style={[styles.vehicleItem, { borderColor: categoryColor, borderWidth: 1 }]}>
                    <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    <View style={[styles.vehicleTypeBadge, { backgroundColor: `${categoryColor}20` }]}>
                      <Text style={[styles.vehicleTypeText, { color: categoryColor }]}>{vehicle.vehicleType}</Text>
                    </View>
                  </View>
                )
              })}
              {pair.length === 1 && <View style={styles.emptyVehicleSlot} />}
            </View>
          ))}
          {item.vehicle_info.length === 0 && <Text style={styles.noVehiclesText}>No vehicles available</Text>}
        </View>

        <Text style={styles.sectionTitle}>Service Areas</Text>
        <View style={styles.serviceAreas}>
          {(expandedServiceAreas[item._id] ? item.service_areas : item.service_areas.slice(0, 2)).map((area) => (
            <View key={area._id} style={styles.serviceAreaItem}>
              <MapPin size={16} color="#666" />
              <Text style={styles.serviceAreaText} numberOfLines={1}>
                {area.name}
              </Text>
            </View>
          ))}
          {item.service_areas.length > 2 && (
            <TouchableOpacity style={styles.moreAreasButton} onPress={() => toggleServiceAreas(item._id)}>
              <Text style={styles.moreAreasText}>
                {expandedServiceAreas[item._id] ? "Show less" : `+${item.service_areas.length - 2} more areas`}
              </Text>
              {expandedServiceAreas[item._id] ? (
                <ChevronUp size={16} color="#E74C3C" />
              ) : (
                <ChevronDown size={16} color="#E74C3C" />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.callTimingContainer}>
          <Clock size={16} color="#666" />
          <Text style={styles.callTimingText}>
            Available: {item.call_timing.start_time} - {item.call_timing.end_time}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={() => handleCall(item)}>
            <Phone size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.messageButton]} onPress={() => handleMessage(item)}>
            <MessageSquare size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <Layout isHeaderShown={false}>
      <ScrollView ref={scrollViewRef} style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, area, vehicle..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E74C3C" />
            <Text style={styles.loadingText}>Finding nearby partners...</Text>
          </View>
        ) : (
          <>
            {/* Category Preview Cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewContainer}>
              {vehicles.map((category) => (
                <TouchableOpacity
                  key={category._id}
                  style={[
                    styles.previewCard,
                    { backgroundColor: category.backgroundColour },
                    selectedCategory === category.category && styles.selectedPreviewCard,
                  ]}
                  onPress={() => setSelectedCategory(category.category)}
                >
                  <Text style={styles.previewTitle}>{category.title}</Text>
                  {category.image && category.image.url && (
                    <Image source={{ uri: category.image.url }} style={styles.previewImage} resizeMode="contain" />
                  )}
                  {selectedCategory === category.category && <View style={styles.selectedIndicator} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Partners List */}
            <View style={styles.partnersContainer}>
              <Text style={styles.partnersTitle}>{filteredPartners.length} Transport Partners Found</Text>

              {filteredPartners.length > 0 ? (
                filteredPartners.map((partner) => renderPartnerItem({ item: partner }))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No partners found</Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={() => {
                      setLoading(true)
                      handleFetch()
                      fetchPartners()
                    }}
                  >
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Message Modal */}
      <Modal
        visible={messageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMessageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Message</Text>
              <TouchableOpacity onPress={() => setMessageModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedPartner && <Text style={styles.modalSubtitle}>To: {selectedPartner.name}</Text>}

            <TextInput
              style={styles.messageInput}
              placeholder="Type your message here..."
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              placeholderTextColor="#999"
            />

            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Call Confirmation Modal */}
      <Modal
        visible={callModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCallModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.callModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Call Partner</Text>
              <TouchableOpacity onPress={() => setCallModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedPartner && (
              <>
                <Text style={styles.callModalText}>Are you sure you want to call</Text>
                <Text style={styles.callModalName}>{selectedPartner.name}?</Text>
                <Text style={styles.callModalPhone}>{selectedPartner.phone_number}</Text>
              </>
            )}

            <View style={styles.callModalButtons}>
              <TouchableOpacity
                style={[styles.callModalButton, styles.cancelButton]}
                onPress={() => setCallModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callModalButton, styles.confirmButton]} onPress={confirmCall}>
                <Text style={styles.confirmButtonText}>Call Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thank You Modal */}
      <Modal
        visible={thankYouModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThankYouModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.thankYouModalContainer}>
            <View style={styles.thankYouIconContainer}>
              <Check size={40} color="#fff" />
            </View>
            <Text style={styles.thankYouTitle}>Thank You!</Text>
            <Text style={styles.thankYouMessage}>{thankYouMessage}</Text>
            <TouchableOpacity style={styles.thankYouButton} onPress={() => setThankYouModalVisible(false)}>
              <Text style={styles.thankYouButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Layout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchInputContainer: {
    height: 50,
    backgroundColor: "#f8f8f8",
    borderRadius: 25,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  loadingContainer: {
    padding: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  previewContainer: {
    paddingVertical: 16,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  previewCard: {
    width: 160,
    height: 120,
    marginLeft: 16,
    borderRadius: 12,
    padding: 15,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
    position: "relative",
    overflow: "hidden",
  },
  selectedPreviewCard: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  selectedIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  previewImage: {
    width: "100%",
    height: 70,
    alignSelf: "flex-end",
  },
  partnersContainer: {
    padding: 16,
  },
  partnersTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  partnerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  partnerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  partnerId: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  vehicleGrid: {
    marginBottom: 16,
  },
  vehicleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  vehicleItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
  },
  emptyVehicleSlot: {
    flex: 1,
    marginLeft: 8,
  },
  vehicleName: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  vehicleTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  vehicleTypeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noVehiclesText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    padding: 10,
  },
  serviceAreas: {
    marginBottom: 16,
  },
  serviceAreaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  serviceAreaText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    flex: 1,
  },
  moreAreasButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  moreAreasText: {
    fontSize: 14,
    color: "#E74C3C",
    marginRight: 4,
  },
  callTimingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  callTimingText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.48,
  },
  callButton: {
    backgroundColor: "#4CAF50",
  },
  messageButton: {
    backgroundColor: "#E74C3C",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: "#E74C3C",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  callModalContainer: {
    minHeight: 250,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  messageInput: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#333",
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  sendButton: {
    backgroundColor: "#E74C3C",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  callModalText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  callModalName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginVertical: 8,
  },
  callModalPhone: {
    fontSize: 18,
    color: "#E74C3C",
    textAlign: "center",
    marginBottom: 24,
  },
  callModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  callModalButton: {
    flex: 0.48,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  thankYouModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "80%",
    alignItems: "center",
  },
  thankYouIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  thankYouTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  thankYouMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  thankYouButton: {
    backgroundColor: "#E74C3C",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  thankYouButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})
