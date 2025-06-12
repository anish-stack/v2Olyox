import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    mapContainer: {
        height: height * 0.45,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    mapOverlayContainer: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    navigationButton: {
        backgroundColor: '#4285F4',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    navigationButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginLeft: 4,
    },
    distanceInfoContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginTop: 8,
    },
    distanceInfoText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    scrollView: {
        flex: 1,
    },
    statusBarContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusStep: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusStepActive: {
        // Active state styling
    },
    statusStepText: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    statusConnector: {
        height: 2,
        backgroundColor: '#DDDDDD',
        flex: 1,
        marginHorizontal: 8,
    },
    statusConnectorActive: {
        backgroundColor: '#4CAF50',
    },
    rideInfoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        margin: 16,
        marginTop: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    rideInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    rideInfoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    rideStatusBadge: {
        backgroundColor: '#E3F2FD',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    rideStatusText: {
        fontSize: 12,
        color: '#1976D2',
        fontWeight: 'bold',
    },
    divider: {
        backgroundColor: '#EEEEEE',
        height: 1,
        marginVertical: 12,
    },
    locationsContainer: {
        marginVertical: 8,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 4,
    },
    locationIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 2,
    },
    locationText: {
        fontSize: 14,
        color: '#333',
    },
    locationConnector: {
        width: 1,
        height: 20,
        backgroundColor: '#DDDDDD',
        marginLeft: 16,
    },
    locationDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#DDDDDD',
        marginLeft: 14,
        marginVertical: 2,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginVertical: 8,
    },
    infoGridItem: {
        width: '50%',
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'flex-start',
    },
    infoGridLabel: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    infoGridValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: 'bold',
    },
    riderInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    riderAvatarContainer: {
        marginRight: 12,
    },
    riderAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    riderDetails: {
        flex: 1,
    },
    riderName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    riderPhone: {
        fontSize: 14,
        color: '#666',
    },
    callButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4CAF50',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonsContainer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    actionButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    actionButtonTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        width: '85%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalCloseButton: {
        padding: 4,
    },
    otpInputContainer: {
        marginVertical: 16,
    },
    otpInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        textAlign: 'center',
        letterSpacing: 8,
        backgroundColor: '#F9F9F9',
    },
    otpInstructions: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    otpSubmitButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    otpSubmitButtonTouchable: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    otpSubmitButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loaderText: {
        fontSize: 16,
        color: '#666',
        marginTop: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginVertical: 16,
    },
    errorButton: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 24,
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerLabelContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 10,
        marginTop: -5,
    },
    markerLabel: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContents: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: height * 0.8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },

    cancelReasonItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "start",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
    },
    selectedReason: {
        backgroundColor: "#e3f2fd",
        borderRadius: 5,
    },
    cancelReasonLabel: {
        fontSize: 16,
        color: "#111827",
    },
    cancelReasonDescription: {
        fontSize: 14,
        color: "#6b7280",
    },
    cancelRideButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#d64444",
        paddingVertical: 12,
        borderRadius: 5,
        marginTop: 20,
    },
    cancelRideText: {
        fontSize: 16,
        color: "#fff",
        marginLeft: 10,
    },
});

export default styles;