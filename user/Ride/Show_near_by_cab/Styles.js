const { StyleSheet, Platform } = require("react-native");

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    currentLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0fffe', 
    },
    textLoader: {
        marginTop: 10,
        fontSize: 16,
        color: '#003873',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#fff',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    backButton: {
        padding: 8,
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    mapContainer: {
        height: 200,
        backgroundColor: '#E5E7EB',
        marginBottom: 16,
    },
    map: {
        flex: 1,
    },
    loaderContainer: {
        padding: 24,
        margin: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    iconContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#EFF6FF',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    loaderTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    loaderMessage: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 16,
    },
    stepIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 4,
    },
    stepDotActive: {
        backgroundColor: '#2563EB',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    rideDetailsCard: {
        margin: 4,
        padding: 16,
        backgroundColor: '#fff',

        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    estimatedTime: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    estimatedTimeText: {
        marginLeft: 4,
        color: '#059669',
        fontWeight: '600',
    },
    rideInfo: {
        marginBottom: 16,
    },
    rideInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    rideInfoText: {
        marginLeft: 12,
    },
    rideInfoLabel: {
        fontSize: 10,
        color: '#6B7280',
        marginBottom: 2,
    },
    rideInfoValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '400',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 16,
    },
    fareDetails: {
        gap: 12,
    },
    fareTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    fareItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fareTotal: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#D62C27',
    },
    bottomContainer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#D62C27',
    },
    paymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    paymentText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#111827',
    },
    changeText: {
        color: '#2563EB',
        fontWeight: '500',
    },
    confirmButton: {
        backgroundColor: '#D62C27',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    confirmButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    confirmButtonPrice: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    errorContainer: {
        position: 'absolute',
        bottom: 90,
        left: 16,
        right: 16,
        backgroundColor: '#FEE2E2',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
    },
    errorText: {
        flex: 1,
        marginLeft: 8,
        color: '#DC2626',
        fontSize: 14,
    },
});