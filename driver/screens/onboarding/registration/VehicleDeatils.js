import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, Modal } from "react-native";
import Input from "../../../components/Input";
import Icon from "react-native-vector-icons/FontAwesome5"; // Ensure you have FontAwesome5 installed or use another icon library

const VehicleDetails = ({ formData, onInputChange }) => {
  const [modalVisible, setModalVisible] = React.useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = React.useState(formData.vehicleType || "");

  const vehicleTypes = ["CAB", "Parcel", "Heavy Transport"];

  const handleVehicleTypeSelect = (type) => {
    setSelectedVehicleType(type);

    onInputChange("vehicleType", type); // Pass the selected value to parent
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Input placeholder="Make" value={formData.make} onChangeText={(text) => onInputChange("make", text)} icon="car" />
      <Input
        placeholder="Model"
        value={formData.model}
        onChangeText={(text) => onInputChange("model", text)}
        icon="car-side"
      />
      <Input
        placeholder="Year"
        value={formData.year}
        onChangeText={(text) => onInputChange("year", text)}
        keyboardType="numeric"
        icon="calendar"
      />
      <Input
        placeholder="License Plate"
        value={formData.licensePlate}
        onChangeText={(text) => onInputChange("licensePlate", text)}
        icon="card-account-details"
      />

      {/* Vehicle Type Dropdown */}
      <TouchableOpacity style={styles.selectContainer} onPress={() => setModalVisible(true)}>
        <Text style={styles.selectText}>
          {selectedVehicleType || "Select Vehicle Type"}
        </Text>
        <Icon name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>

      {/* Modal for selecting vehicle type */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackground} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View>
              {vehicleTypes && vehicleTypes.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => handleVehicleTypeSelect(item)}
                  style={styles.modalItem}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  selectContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
    marginBottom: 16,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: "#6b7280",
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    width: "80%",
    maxHeight: "60%",
    padding: 16,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalItemText: {
    fontSize: 18,
    color: "#333",
  },
});

export default VehicleDetails;
