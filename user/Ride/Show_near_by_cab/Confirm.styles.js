import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 120,
    },

    // Header styles
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
    },
    placeholder: {
        width: 40,
    },

    // Map container
    mapContainer: {
        height: height * 0.5,
        width: '100%',
        backgroundColor: '#f0f0f0',
    },

    // Ride details card
    rideDetailsCard: {
        margin: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    estimatedTime: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E6F7EF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    estimatedTimeText: {
        marginLeft: 4,
        color: '#059669',
        fontWeight: '600',
        fontSize: 12,
    },

    // Ride info
    rideInfo: {
        marginBottom: 16,
    },
    rideInfoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 8,
    },
    rideInfoText: {
        marginLeft: 12,
        flex: 1,
    },
    rideInfoLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    rideInfoValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    locationConnector: {
        position: 'absolute',
        left: 12,
        top: 32,
        height: 30,
        alignItems: 'center',
    },
    locationDot: {
        width: 4,
        height: 4,
        backgroundColor: '#999',
        borderRadius: 2,
    },
    locationLine: {
        width: 1,
        height: 20,
        backgroundColor: '#999',
        marginVertical: 2,
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 16,
    },

    // Fare details
    fareDetails: {
        marginTop: 8,
    },
    fareTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    fareItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    fareItemText: {
        color: '#666',
        fontSize: 14,
    },
    fareItemValue: {
        color: '#333',
        fontSize: 14,
    },
    fareTotal: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    totalText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    totalAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    loadingFare: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    loadingFareText: {
        marginLeft: 8,
        color: '#666',
    },

    // Bottom container
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    paymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    paymentText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    changeText: {
        color: '#2563EB',
        fontSize: 14,
        fontWeight: '500',
    },
    confirmButton: {
        backgroundColor: COLORS.error,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#999',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    confirmButtonPrice: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Error container
    errorContainer: {
        position: 'absolute',
        bottom: 90,
        left: 16,
        right: 16,
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    errorText: {
        color: '#DC2626',
        marginLeft: 8,
        flex: 1,
        fontSize: 14,
    },
    dismissButton: {
        padding: 4,
    },

    // Connection warning
    connectionWarning: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        backgroundColor: '#DC2626',
        padding: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    connectionWarningText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 12,
        fontWeight: '500',
    },

    // Loader styles
    initialLoadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialLoadingText: {
        marginTop: 16,
        color: '#666',
        fontSize: 16,
    },
    loaderContainer: {
        margin: 16,
        padding: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E6F2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    loaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    loaderMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 16,
    },
    timerText: {
        marginLeft: 6,
        color: '#666',
        fontSize: 14,
    },
    stepIndicatorContainer: {
        flexDirection: 'row',
        marginTop: 8,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ddd',
        marginHorizontal: 4,
    },
    stepDotActive: {
        backgroundColor: '#1976D2',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cancelButton: {
        marginTop: 16,
        padding: 8,
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 14,
    },

    // Current loader (legacy)
    currentLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textLoader: {
        marginTop: 16,
        color: '#666',
        fontSize: 16,
    },
});