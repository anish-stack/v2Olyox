import { StyleSheet, Dimensions, Platform } from "react-native"

const { width, height } = Dimensions.get("window")

export default StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  waitingContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  waitingAnimation: {
    width: 200,
    height: 200,
  },
  waitingText: {
    fontSize: 18,
    color: "#4B5563",
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  offlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
    justifyContent: "center",
  },
  offlineText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#E53935",
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#E53935",
  },
  mapContainer: {
    width: "100%",
    height: height * 0.2,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  map: {
    width: "100%",
    height: "100%",
  },
  pickupMarker: {
    alignItems: "center",
  },
  dropMarker: {
    alignItems: "center",
  },
  modalContainer: {
    margin: 16,
    maxHeight: height * 0.9,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    maxHeight: height * 0.9,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  soundToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  userImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  userContact: {
    fontSize: 14,
    color: "#6B7280",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 6,
    borderRadius: 8,
  },
  ratingText: {
    marginLeft: 4,
    fontWeight: "600",
    color: "#92400E",
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  timerText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "500",
  },
  timerBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  timerProgress: {
    height: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 3,
  },
  locationContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  locationText: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  locationDesc: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  locationDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginHorizontal: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 4,
  },
  tollInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  tollText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#4F46E5",
    fontWeight: "500",
  },
  noteContainer: {
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 20,
  },
  noteText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#D9534F",
  },
  noteRegular: {
    color: "#212529",
    fontWeight: "normal",
  },
  noteHighlight: {
    color: "#D9534F",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
  },
  acceptButton: {
    backgroundColor: "#6366F1",
  },
  rejectButton: {
    borderColor: "#EF4444",
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  rejectButtonLabel: {
    color: "#EF4444",
  },
  snackbar: {
    backgroundColor: "#4B5563",
    borderRadius: 8,
    marginBottom: 16,
  },
  snackbarSuccess: {
    backgroundColor: "#10B981",
  },
  snackbarError: {
    backgroundColor: "#EF4444",
  },
})
