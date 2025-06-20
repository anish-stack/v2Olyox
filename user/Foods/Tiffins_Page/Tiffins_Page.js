import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Dimensions,
  RefreshControl,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const BASE_URL = `http://192.168.1.6:3100/api/v1/tiffin/find_Restaurant_Packages`;

const MealTypeFilter = ({ selected, onSelect }) => {
  const filters = [
    { id: 'all', label: 'All', icon: 'food-variant' },
    { id: 'breakfast', label: 'Breakfast', icon: 'coffee' },
    { id: 'lunch', label: 'Lunch', icon: 'food' },
    { id: 'dinner', label: 'Dinner', icon: 'food-turkey' },
  ];

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContainer}
    >
      {filters.map(filter => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.filterButton,
            selected === filter.id && styles.filterButtonActive
          ]}
          onPress={() => onSelect(filter.id)}
        >
          <MaterialCommunityIcons
            name={filter.icon}
            size={20}
            color={selected === filter.id ? '#fff' : '#D32F2F'}
          />
          <Text style={[
            styles.filterText,
            selected === filter.id && styles.filterTextActive
          ]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const TiffinsPage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(BASE_URL);
      
      // Randomize the order of packages on each fetch/refresh
      const shuffledPackages = [...response.data.packages].sort(() => Math.random() - 0.5);
      
      setPackages(shuffledPackages);
      setError(null);
    } catch (err) {
      setError("Couldn't load tiffin packages");
      console.error("Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPackages();
  }, [fetchPackages]);

  const handleCall = useCallback((phoneNumber) => {
    let formattedNumber = phoneNumber.toString();
    if (Platform.OS !== 'android') {
      formattedNumber = `telprompt:${formattedNumber}`;
    } else {
      formattedNumber = `tel:${formattedNumber}`;
    }
    
    Linking.canOpenURL(formattedNumber)
      .then(supported => {
        if (supported) {
          return Linking.openURL(formattedNumber);
        }
      })
      .catch(err => console.error('Error making phone call:', err));
  }, []);

  const toggleMenu = useCallback((id) => {
    setExpandedId(expandedId === id ? null : id);
  }, [expandedId]);

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = 
        pkg.packageName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.restaurant_id.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (selectedFilter === 'all') return matchesSearch;
      
      return matchesSearch && pkg.meals[selectedFilter]?.enabled;
    });
  }, [packages, searchQuery, selectedFilter]);

  const renderPackageCard = ({ item: pkg }) => (
    <View style={styles.packageCard}>
      <Image
        source={{ uri: pkg.images?.url || "https://via.placeholder.com/300x200" }}
        style={styles.packageImage}
        resizeMode="cover"
      />
      
      <View style={styles.cardContent}>
        <View style={styles.ratingBadge}>
          <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{pkg.restaurant_id.rating || 'New'}</Text>
        </View>

        <Text numberOfLines={2} style={styles.packageName}>
          {pkg?.packageName || 'Package'}
        </Text>

        <Text numberOfLines={1} style={styles.restaurantName}>
          {pkg.restaurant_id.restaurant_name}
        </Text>

        <Text numberOfLines={1} style={styles.locationText}>
          <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
          {' '}{pkg.restaurant_id.restaurant_address.city}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{pkg.totalPrice}</Text>
          <Text style={styles.duration}>{pkg.duration} days</Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => toggleMenu(pkg._id)}
          >
            <Text style={styles.viewButtonText}>
              {expandedId === pkg._id ? 'Hide Menu' : 'View Menu'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => handleCall(pkg.restaurant_id.restaurant_contact)}
          >
            <MaterialCommunityIcons name="phone" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {expandedId === pkg._id && (
          <View style={styles.menuContainer}>
            {Object.entries(pkg.meals).map(([type, meal]) => {
              if (!meal.enabled || !meal.items?.length) return null;
              return (
                <View key={type} style={styles.mealSection}>
                  <View style={styles.mealTypeHeader}>
                    <MaterialCommunityIcons 
                      name={type === 'breakfast' ? 'coffee' : type === 'lunch' ? 'food' : 'food-turkey'} 
                      size={16} 
                      color="#D32F2F" 
                    />
                    <Text style={styles.mealType}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </View>
                  {meal.items.map((item, idx) => (
                    <Text key={idx} style={styles.menuItem}>
                      • {item.name} {item.price > 0 ? `(₹${item.price})` : ''}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D32F2F" />
        <Text style={styles.loadingText}>Loading tiffin packages...</Text>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle" size={48} color="#D32F2F" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchPackages}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Tiffin Services</Text>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={24} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search packages or restaurants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <MealTypeFilter
          selected={selectedFilter}
          onSelect={setSelectedFilter}
        />
      </View>

      <FlatList
        data={filteredPackages}
        renderItem={renderPackageCard}
        keyExtractor={item => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={['#D32F2F']}
            tintColor="#D32F2F"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="food-off" size={64} color="#D32F2F" />
            <Text style={styles.emptyText}>No packages found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#D32F2F',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  filterButtonActive: {
    backgroundColor: '#D32F2F',
  },
  filterText: {
    marginLeft: 8,
    color: '#D32F2F',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  packageCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  packageImage: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
  },
  cardContent: {
    padding: 12,
  },
  ratingBadge: {
    position: 'absolute',
    top: -20,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ratingText: {
    marginLeft: 4,
    fontWeight: 'bold',
    color: '#333',
  },
  packageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 14,
    color: '#D32F2F',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  duration: {
    fontSize: 14,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  viewButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 8,
  },
  mealSection: {
    marginBottom: 10,
  },
  mealTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D32F2F',
    marginLeft: 6,
  },
  menuItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
    paddingLeft: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 16,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  }
});

export default TiffinsPage;