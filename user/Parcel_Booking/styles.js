import { StyleSheet, Dimensions, Platform } from "react-native"

const { width, height } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  searchContainer: {
    padding: 16,
    flex: 1,
  },
  locationInputs: {
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    padding: 16,
    maxHeight: 400,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: "#333",
    textAlign: "left",
  },
  addStopButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  addStopText: {
    marginLeft: 12,
    color: "#e53935",
    fontSize: 16,
    fontWeight: "500",
  },
  suggestionsList: {
    marginTop: 16,
    maxHeight: 400,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  suggestionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  loader: {
    marginTop: 16,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#e53935",
  },
  errorText: {
    color: "#e53935",
    fontSize: 14,
  },

  // Trip Summary Styles
  tripSummaryContainer: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tripSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tripSummaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  tripDistance: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tripDistanceText: {
    marginLeft: 6,
    fontWeight: "500",
    color: "#333",
  },
  tripDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tripDetailText: {
    marginLeft: 8,
    color: "#555",
    fontSize: 14,
  },

  // Vehicle Options Styles
  vehicleOptionsContainer: {
    marginTop: 16,
  },
  vehicleOptionsTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
    color: "#333",
  },
  vehicleOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  vehicleOption: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: "#f9f9f9",
  },
  vehicleOptionSelected: {
    borderColor: "#e53935",
    backgroundColor: "#fff",
  },
  vehicleOptionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
  },
  vehicleOptionPrice: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
  },
  vehicleOptionTextSelected: {
    color: "#e53935",
  },

  // Fare Styles
  fareContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  fareLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e53935",
  },

  // Continue Button Styles
  continueButtonContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  continueButton: {
    backgroundColor: "#e53935",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    width: "100%",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 16,
    maxHeight: height * 0.9,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalContent: {
    paddingBottom: 16,
  },
  selectedLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  locationIcon: {
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#333",
  },
  locationAddress: {
    fontSize: 14,
    color: "#666",
  },
  changeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
  },
  changeButtonText: {
    color: "#2196F3",
    fontWeight: "500",
  },

  // Modal Trip Summary
  modalTripSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalTripDetail: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTripDetailText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#555",
  },

  // Modal Input Styles
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginVertical: 8,
    color: "#333",
    backgroundColor: "#fff",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#e53935",
    borderColor: "#e53935",
  },
  checkmark: {
    color: "white",
    fontSize: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
  },
  saveAsLabel: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  saveAsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  saveAsOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    backgroundColor: "#f5f5f5",
  },
  saveAsText: {
    marginTop: 4,
    fontSize: 14,
    color: "#757575",
  },
  selectedSaveOption: {
    borderColor: "#e53935",
    backgroundColor: "#fff",
  },
  selectedSaveText: {
    color: "#e53935",
  },

  // Modal Fare Summary
  modalFareSummary: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
  },
  modalFareTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  modalFareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalFareLabel: {
    fontSize: 14,
    color: "#666",
  },
  modalFareValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  discountText: {
    color: "#4CAF50",
  },
  modalFareTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalFareTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  modalFareTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e53935",
  },

  // Button Styles
  enterDetailsButton: {
    backgroundColor: "#ccc",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  enterDetailsButtonActive: {
    backgroundColor: "#e53935",
  },
  enterDetailsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default styles
