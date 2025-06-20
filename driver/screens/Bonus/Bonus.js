
import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from "react-native"
import axios from "axios"
import * as SecureStore from "expo-secure-store"
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons"


export default function Bonus() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [bonusData, setBonusData] = useState(null)

  const fetchUserDetails = useCallback(async () => {
    try {
      setError(null)
      const token = await SecureStore.getItemAsync("auth_token_cab")

      if (!token) {
        throw new Error("Authentication token not found. Please login again.")
      }

      const response = await axios.get("http://192.168.1.6:3100/api/v1/rider/user-details", {
        headers: { Authorization: `Bearer ${token}` },
      })

      const partnerId = response.data?.partner?._id

      if (!partnerId) {
        throw new Error("Partner ID not found in user details.")
      }

      const bonusResponse = await axios.get(`http://192.168.1.6:3100/api/v1/rides/getMyEligibleBonus/${partnerId}`)

      setBonusData(bonusResponse.data)
      return true
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message || "Failed to fetch bonus data"
      setError(errorMessage)
      Alert.alert("Error", errorMessage)
      return false
    }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchUserDetails()
    setRefreshing(false)
  }, [fetchUserDetails])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchUserDetails()
      setLoading(false)
    }

    loadData()
  }, [fetchUserDetails])

  const getBonusTypeIcon = (type) => {
    return type === "fixed" ? (
      <FontAwesome5 name="money-bill-wave" size={16} color="#2c3e50" />
    ) : (
      <FontAwesome5 name="percentage" size={16} color="#2c3e50" />
    )
  }

  const getBonusStatusColor = (status) => {
    return status === "active" ? "#4caf50" : "#f44336"
  }

  const renderBonusCard = (bonus, index, eligible) => {
    const workedHours = bonus.requiredHours - (bonus.remainingHours || 0)
    const progressPercent = Math.min((workedHours / bonus.requiredHours) * 100, 100)
    const formattedProgress = progressPercent.toFixed(0)

    return (
      <View key={index} style={[styles.card, { borderLeftColor: getBonusStatusColor(bonus.bonusStatus) }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.bonusCode}>{bonus.bonusCouponCode}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getBonusStatusColor(bonus.bonusStatus) }]}>
            <Text style={styles.statusText}>{bonus.bonusStatus}</Text>
          </View>
        </View>

        <View style={styles.bonusValueContainer}>
          <Text style={styles.bonusValue}>
            {bonus.bonusType === "fixed" ? "₹" : ""}
            {bonus.bonusValue}
            {bonus.bonusType === "percentage" ? "%" : ""}
          </Text>
          <View style={styles.bonusTypeContainer}>
            {getBonusTypeIcon(bonus.bonusType)}
            <Text style={styles.bonusTypeText}>{bonus.bonusType}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Progress: {formattedProgress}%</Text>
            <Text style={styles.hoursText}>
              {workedHours.toFixed(1)} / {bonus.requiredHours} hours
            </Text>
          </View>

          <View style={styles.progressBarWrapper}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: eligible ? "#4caf50" : "#f44336",
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Requirements:</Text>
          {bonus.any_required_field?.map((field, i) => (
            <View key={i} style={styles.requirementRow}>
              <MaterialIcons name="check-circle" size={14} color="#4caf50" style={styles.requirementIcon} />
              <Text style={styles.requirement}>{field}</Text>
            </View>
          ))}
        </View>
      </View>
    )
  }

  const renderEmptyState = (message) => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="hourglass-empty" size={50} color="#ccc" />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading your bonuses...</Text>
      </View>
    )
  }

  if (error && !bonusData) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={60} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0066cc"]} />}
      >
        {bonusData?.eligibleBonus?.length > 0 ? (
          <View style={styles.headerContainer}>
            <Text style={styles.heading}>Eligible Bonuses</Text>
            {!loading && bonusData?.eligibleBonus?.length === 0 && (
              <Text style={styles.subHeading}>Complete more hours to unlock bonuses</Text>
            )}
          </View>
        ) : null}


        {bonusData?.eligibleBonus?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollContainer}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {bonusData.eligibleBonus
              .filter(bonus => bonus.bonusStatus === 'active') // ✅ Only include "active" bonuses
              .map((bonus, index) => renderBonusCard(bonus, index, true))}
          </ScrollView>
        ) : null}


        <View style={styles.headerContainer}>
          <Text style={styles.heading}>Upcoming Bonuses</Text>
          <Text style={styles.subHeading}>Keep working to unlock these bonuses</Text>
        </View>

        {bonusData?.notEligibleBonus?.filter(bonus => bonus.bonusStatus === 'active')?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollContainer}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {bonusData.notEligibleBonus
              .filter(bonus => bonus.bonusStatus === 'active') // ✅ Filter for active only
              .map((bonus, index) => renderBonusCard(bonus, index, false))}
          </ScrollView>
        ) : (
          renderEmptyState("No upcoming bonuses available")
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#0066cc",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#0066cc",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  headerContainer: {
    paddingHorizontal: 15,
    marginTop: 15,
    marginBottom: 5,
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  subHeading: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 2,
  },
  scrollContainer: {
    marginBottom: 20,
  },
  horizontalScrollContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  card: {
    width: 300,
    padding: 15,
    marginRight: 15,
    borderRadius: 12,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  bonusCode: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  bonusValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  bonusValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  bonusTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecf0f1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  bonusTypeText: {
    fontSize: 12,
    color: "#2c3e50",
    marginLeft: 4,
  },
  progressSection: {
    marginBottom: 15,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
  },
  hoursText: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  progressBarWrapper: {
    width: "100%",
    height: 10,
    backgroundColor: "#ecf0f1",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 5,
  },
  requirementsContainer: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 5,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  requirementIcon: {
    marginRight: 5,
    marginTop: 2,
  },
  requirement: {
    fontSize: 13,
    color: "#34495e",
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: "white",
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 10,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: "#95a5a6",
    textAlign: "center",
  },
})
