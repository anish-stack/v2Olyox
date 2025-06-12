import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F8F8',
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1C1C1C',
    },
    viewAllButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    viewAllText: {
        color: '#E23744',
        fontSize: 14,
        fontWeight: '600',
    },
    cardsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    foodCard: {
        width: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    imageContainer: {
        position: 'relative',
        height: 140,
    },
    foodImage: {
        width: '100%',
        height: '100%',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    offerBadge: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: '#002B93',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    offerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    offerSubtext: {
        color: '#FFFFFF',
        fontSize: 10,
    },
    bookmarkButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: 6,
        borderRadius: 50,
    },
    content: {
        padding: 12,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    restaurantName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1C1C1C',
        flex: 1,
        marginRight: 8,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#48C479',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    rating: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        marginRight: 2,
    },
    cuisines: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 6,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    deliveryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 12,
        color: '#666666',
        marginLeft: 4,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#666666',
        marginHorizontal: 6,
    },
    priceText: {
        fontSize: 12,
        color: '#666666',
    },

searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 40,
},
searchIcon: {
    marginRight: 8,
},
searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
},
clearButton: {
    padding: 4,
},
filtersContainer: {
    marginBottom: 15,
},
filterOptionsContainer: {
    marginTop: 8,
},
filterSection: {
    marginBottom: 10,
},
filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
},
categoryScrollView: {
    flexDirection: 'row',
},
categoryChip: {
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
},
selectedCategoryChip: {
    backgroundColor: '#FF6B00',
},
categoryChipText: {
    fontSize: 13,
    color: '#333',
},
selectedCategoryChipText: {
    color: '#FFF',
},
priceButtonsContainer: {
    flexDirection: 'row',
},
priceButton: {
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
},
selectedPriceButton: {
    backgroundColor: '#FF6B00',
},
priceButtonText: {
    fontSize: 13,
    color: '#333',
},
iconButton: {
    padding: 6,
    marginRight: 8,
},
headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
},
resultsContainer: {
    flex: 1,
},
resultCount: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
},
noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
},
noResultsText: {
    fontSize: 16,
    color: '#888',
    marginVertical: 12,
},
resetButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
},
resetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
},
flatListContainer: {
    paddingBottom: 20,
},
footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
},
footerLoaderText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
},
selectedPriceButtonText: {
    color: '#FFF',
},
});