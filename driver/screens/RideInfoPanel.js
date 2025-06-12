import React from "react"
import { View, TouchableOpacity } from "react-native"
import { Text, Divider } from "react-native-paper"
import { MaterialIcons } from "@expo/vector-icons"

export const RideInfoPanel = React.memo(
  ({
    state,
    updateState,
    rideStarted,
    kmOfRide,
    distanceToPickup,
    timeToPickup,
    pickup_desc,
    drop_desc,
    params,
    handleCompleteRide,
  }) => {
    return (
      <View
        style={{
          backgroundColor: "white",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              {rideStarted ? "Ride in Progress" : "Heading to Pickup"}
            </Text>
            <Text style={{ color: "#666", marginTop: 5 }}>
              {rideStarted ? `${kmOfRide} km total ride` : `${distanceToPickup || "0"} km to pickup`}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: rideStarted ? "#4CAF50" : "#FF9800",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 15,
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>
              {rideStarted ? "In Progress" : params?.ride_is_started ? "Pickup" : "Progress"}
            </Text>
          </View>
        </View>

        <Divider style={{ marginVertical: 10 }} />

        <View style={{ marginBottom: 15 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ backgroundColor: "#4CAF50", width: 10, height: 10, borderRadius: 5, marginRight: 10 }} />
            <Text style={{ flex: 1 }}>{pickup_desc || params?.pickup_desc}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ backgroundColor: "#F44336", width: 10, height: 10, borderRadius: 5, marginRight: 10 }} />
            <Text style={{ flex: 1 }}>{drop_desc || params?.drop_desc}</Text>
          </View>
        </View>

        {!rideStarted && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#f0f0f0",
              padding: 10,
              borderRadius: 8,
              marginBottom: 15,
            }}
          >
            <MaterialIcons name="access-time" size={24} color="#FF3B30" style={{ marginRight: 10 }} />
            <Text>
              Estimated time to pickup: <Text style={{ fontWeight: "bold" }}>{timeToPickup || "0"} min</Text>
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {!rideStarted ? (
            <>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#f0f0f0",
                  padding: 15,
                  borderRadius: 8,
                  alignItems: "center",
                  marginRight: 10,
                }}
                onPress={() => updateState({ showCancelModal: true })}
              >
                <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>Cancel Ride</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#FF3B30", padding: 15, borderRadius: 8, alignItems: "center" }}
                onPress={() => updateState({ showOtpModal: true })}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>Enter OTP</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: "#4CAF50", padding: 15, borderRadius: 8, alignItems: "center" }}
              onPress={handleCompleteRide}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>Complete Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  },
)

