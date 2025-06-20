import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, RefreshControl, SafeAreaView, StatusBar } from 'react-native'
import React, { useState, useEffect } from 'react'
import { find_me } from '../../../utils/helpers'
import axios from 'axios'
import { useNavigation } from '@react-navigation/native'

export default function Parcel_Orders() {
  const [parcels, setParcels] = useState([])
  const [filteredParcels, setFilteredParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const navigation = useNavigation()

  useEffect(() => {
    getMyParcels()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredParcels(parcels)
    } else {
      const filtered = parcels.filter(parcel => 
        parcel.ride_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        parcel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        parcel.status.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredParcels(filtered)
    }
  }, [searchQuery, parcels])

  const getMyParcels = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const user = await find_me()
      if (!user?.user?._id) {
        throw new Error('User not found')
      }
      
      const response = await axios.get(
        `http://192.168.1.6:3100/api/v1/heavy/get-my-all-parcel/${user.user._id}`
      )
      
      if (response.data.success) {
        setParcels(response.data.parcels)
        setFilteredParcels(response.data.parcels)
      } else {
        throw new Error(response.data.message || 'Failed to fetch parcels')
      }
    } catch (error) {
      console.log("Error fetching parcels:", error.response.data)
      setError('Failed to load parcels. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    getMyParcels()
  }

  const handleViewDetails = (parcel) => {
    console.log("Parcel ID:", parcel)
    navigation.navigate('Booking_Complete_Find_Rider', { id: parcel });
  }

  const handleCancelParcel = async (parcelId) => {
    Alert.alert(
      "Cancel Parcel",
      "Are you sure you want to cancel this parcel?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)
              const user = await find_me()
              
              // Replace with your actual cancel API endpoint
              const response = await axios.post(
                `http://192.168.1.6:3100/api/v1/heavy/cancel-parcel/${parcelId}`,
                { userId: user?.user?._id }
              )
              
              if (response.data.success) {
                Alert.alert("Success", "Parcel cancelled successfully")
                getMyParcels() // Refresh the list
              } else {
                throw new Error(response.data.message || 'Failed to cancel parcel')
              }
            } catch (error) {
              console.log("Error cancelling parcel:", error)
              Alert.alert("Error", "Failed to cancel parcel. Please try again.")
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  const renderParcelItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.parcelCard}
        onPress={() => handleViewDetails(item._id)}
      >
        <View style={styles.parcelHeader}>
          <Text style={styles.parcelId}>{item.ride_id}</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getStatusColor(item.status) }
          ]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <View style={styles.parcelInfo}>
          <Text style={styles.infoLabel}>Recipient:</Text>
          <Text style={styles.infoValue}>{item.name}</Text>
        </View>
        
        <View style={styles.parcelInfo}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoValue}>{item.phone}</Text>
        </View>
        
        <View style={styles.parcelInfo}>
          <Text style={styles.infoLabel}>Address:</Text>
          <Text style={styles.infoValue}>{item.apartment}</Text>
        </View>
        
        <View style={styles.parcelInfo}>
          <Text style={styles.infoLabel}>Vehicle:</Text>
          <Text style={styles.infoValue}>{item.vehicle_id?.title || 'N/A'}</Text>
        </View>
        
        <View style={styles.parcelInfo}>
          <Text style={styles.infoLabel}>Distance:</Text>
          <Text style={styles.infoValue}>{item.km_of_ride} km</Text>
        </View>
        
        <View style={styles.parcelFooter}>
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => handleViewDetails(item._id)}
          >
            <Text style={styles.detailsButtonText}>View Details</Text>
          </TouchableOpacity>
          
          {item.status === 'pending' && (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => handleCancelParcel(item._id)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#FFA500'
      case 'delivered':
        return '#4CAF50'
      case 'cancelled':
        return '#F44336'
      case 'in progress':
        return '#2196F3'
      default:
        return '#757575'
    }
  }

  const renderEmptyComponent = () => {
    if (loading) return null
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No parcels found</Text>
        <TouchableOpacity 
          style={styles.bookButton}
          onPress={() => navigation.navigate('BookParcel')}
        >
          <Text style={styles.bookButtonText}>Book a Parcel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#D32F2F" barStyle="light-content" />
      
    
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID, name or status..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={getMyParcels}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredParcels}
          renderItem={renderParcelItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#D32F2F']}
            />
          }
        />
      )}
      
      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D32F2F" />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#D32F2F',
    padding: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  listContainer: {
    padding: 12,
    paddingBottom: 20,
  },
  parcelCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  parcelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  parcelId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  parcelInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
  },
  parcelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailsButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  detailsButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D32F2F',
  },
  cancelButtonText: {
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 16,
  },
  bookButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  bookButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
})