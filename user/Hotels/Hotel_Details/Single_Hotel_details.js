"use client"

import { useState, useEffect, useCallback } from "react"
import {
    View,
    Text,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Linking,
    Alert,
} from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import Layout from "../../components/Layout/_layout"
import { useNavigation, useRoute } from "@react-navigation/native"
import { findHotelsDetails } from "../utils/Hotel.data"
import BookingModal from "./BookingModal"
import styles from "./SingleHotelDetails.style"
import { useGuest } from "../../context/GuestLoginContext"

const getAmenityIcon = (amenity) => {
    const iconMap = {
        AC: "air-conditioner",
        freeWifi: "wifi",
        kitchen: "food",
        TV: "television",
        powerBackup: "power-plug",
        geyser: "water-boiler",
        parkingFacility: "parking",
        elevator: "elevator",
        cctvCameras: "cctv",
        diningArea: "table-furniture",
        privateEntrance: "door",
        reception: "desk",
        caretaker: "account-tie",
        security: "shield-check",
        checkIn24_7: "hours-24",
        dailyHousekeeping: "broom",
        fireExtinguisher: "fire-extinguisher",
        firstAidKit: "medical-bag",
        buzzerDoorBell: "bell",
        attachedBathroom: "shower",
    }
    return iconMap[amenity] || "checkbox-marked-circle"
}

const formatAmenityName = (amenity) => {
    return amenity
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
}

export default function SingleHotelDetails() {
    const route = useRoute()
    const { id } = route.params || {}
    const { isGuest } = useGuest()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [showAllAmenities, setShowAllAmenities] = useState(false)
    const [imageError, setImageError] = useState(false);
    const navigation = useNavigation()

    const fetchData = useCallback(
        async (showLoader = true) => {
            try {
                if (showLoader) setLoading(true)
                const response = await findHotelsDetails(id)
                if (response.data) {
                    setData(response.data)
                    setError(null)
                } else {
                    setError("No hotel data found")
                }
            } catch (error) {
                setError("Failed to fetch hotel details")
                console.error(error)
            } finally {
                setLoading(false)
                setRefreshing(false)
            }
        },
        [id],
    )

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleRefresh = useCallback(() => {
        setRefreshing(true)
        fetchData(false)
    }, [fetchData])

    const handleCall = useCallback(() => {
        const phoneNumber = data?.hotel_user?.hotel_phone
        if (phoneNumber) {
            Linking.openURL(`tel:${phoneNumber}`)
        }
    }, [data])

    if (loading) {
        return (
            <Layout>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#E41D57" />
                </View>
            </Layout>
        )
    }

    if (error) {
        return (
            <Layout>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </Layout>
        )
    }
    if (isGuest) {
        return Alert.alert(
          "Create an Account to Continue",
          "To book a Hotel Room, please create an account. It only takes a moment, and you'll be ready to go!",
          [
            {
              text: "OK",
              onPress: () => {
                // Navigate to Onboarding when OK is pressed
                navigation.navigate("Onboarding");
              },
            },
            {
              text: "Cancel",
              onPress: () => {
                // Navigate back to the previous screen when Cancel is pressed
                navigation.goBack();
              },
            },
          ],
          { cancelable: false }
        );
      }
    const activeAmenities = Object.entries(data?.hotel_user?.amenities || {})
        .filter(([_, value]) => value)
        .map(([key]) => key)

    const displayedAmenities = showAllAmenities ? activeAmenities : activeAmenities.slice(0, 6)

    return (
        <Layout>
            <ScrollView
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <Image
                    style={styles.mainImage}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                    source={
                        imageError
                            ? require('./no-image.jpeg')
                            : { uri: data?.main_image?.url }
                    }
                />

                <View style={styles.ratingBadge}>
                    <Icon name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>{data?.rating_number}</Text>
                    <Text style={styles.reviewCount}>({data?.number_of_rating_done} reviews)</Text>
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.hotelName}>{data?.hotel_user?.hotel_name}</Text>
                    <Text style={styles.hotelAddress}>{data?.hotel_user?.hotel_address}</Text>
                    <Text style={styles.roomType}>{data?.room_type}</Text>
                    {data?.hotel_user?.isVerifiedTag && (
                        <View style={styles.verifiedBadge}>
                            <Icon name="check-decagram" size={16} color="#22C55E" />
                            <Text style={styles.verifiedText}>Olyox Verified Hotel</Text>
                        </View>
                    )}

                    <View style={styles.tagsContainer}>
                        {data?.has_tag?.map((tag) => (
                            <View key={tag} style={styles.tag}>
                                <Text style={styles.tagText}>{tag.replace("_", " ")}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.priceSection}>
                        <View>
                            <Text style={styles.cutPrice}>₹{data?.cut_price}</Text>
                            <Text style={styles.price}>₹{data?.book_price}</Text>
                        </View>
                        <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>{data?.discount_percentage}% OFF</Text>
                        </View>
                    </View>

                    <View style={styles.infoSection}>
                        <View style={styles.infoItem}>
                            <Icon name="account-group" size={24} color="#666" />
                            <Text style={styles.infoText}>Allowed Guests: {data?.allowed_person}</Text>
                        </View>
                    </View>

                    <View style={styles.amenitiesSection}>
                        <Text style={styles.sectionTitle}>Amenities</Text>
                        <View style={styles.amenitiesGrid}>
                            {displayedAmenities.map((amenity) => (
                                <View key={amenity} style={styles.amenityItem}>
                                    <Icon name={getAmenityIcon(amenity)} size={24} color="#E41D57" />
                                    <Text style={styles.amenityText}>{formatAmenityName(amenity)}</Text>
                                </View>
                            ))}
                        </View>
                        {activeAmenities.length > 6 && (
                            <TouchableOpacity style={styles.showMoreButton} onPress={() => setShowAllAmenities(!showAllAmenities)}>
                                <Text style={styles.showMoreText}>{showAllAmenities ? "Show Less" : "Show More"}</Text>
                                <Icon name={showAllAmenities ? "chevron-up" : "chevron-down"} size={20} color="#E41D57" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {data?.cancellation_policy && (
                        <View style={styles.policySection}>
                            <Text style={styles.sectionTitle}>Cancellation Policy</Text>
                            {data.cancellation_policy.map((policy, index) => (
                                <View key={index} style={styles.policyItem}>
                                    <Icon name="information" size={20} color="#666" />
                                    <Text style={styles.policyText}>{policy}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {data?.isPackage && data?.package_add_ons && (
                        <View style={styles.policySection}>
                            <Text style={styles.sectionTitle}>Package Add-ons</Text>
                            {data.package_add_ons.map((addon, index) => (
                                <View key={index} style={styles.policyItem}>
                                    <Icon name="package-variant" size={20} color="#666" />
                                    <Text style={styles.policyText}>{addon}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                    <Icon name="phone" size={24} color="#fff" />
                    <Text style={styles.callButtonText}>Call Hotel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bookButton} onPress={() => setShowModal(true)}>
                    <Text style={styles.bookButtonText}>Book Now</Text>
                </TouchableOpacity>
            </View>

            <BookingModal visible={showModal} allowed_person={data?.allowed_person} onClose={() => setShowModal(false)} roomData={data} />
        </Layout>
    )
}

