import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 8, // Reduced padding to accommodate two cards
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    viewAllButton: {
        backgroundColor: COLORS.zom,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    viewAllText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '600',
    },
    cardsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    card: {
      
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 1,
    },
    imageContainer: {
        position: 'relative',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 100, // Slightly reduced height for better proportions
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    ratingBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: COLORS.zom,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    content: {
        padding: 12,
    },
    name: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    location: {
        fontSize: 8,
        color: '#666666',
        marginLeft: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5E5',
        marginVertical: 8,
    },
    bottomRow: {
        flexDirection: 'row', // Changed to column for better space usage
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 1,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    price: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.zom,
    },
    perNight: {
        fontSize: 12,
        color: '#666666',
        marginLeft: 4,
    },
    bookButton: {
        backgroundColor: COLORS.zom,
        paddingHorizontal: 7,
        paddingVertical: 6,
        borderRadius: 8,
        // width: '100%', // Full width button
        alignItems: 'center',
    },
    bookButtonText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '600',
    },
    amenitiesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    amenityBadge: {
        backgroundColor: '#F7F7F7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 4,
        marginBottom: 4,
    },
    amenityText: {
        fontSize: 10,
        color: '#666666',
    },
});