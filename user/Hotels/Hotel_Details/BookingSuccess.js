import { View, Text, TouchableOpacity, Linking, ScrollView, Image } from "react-native"
import { useRoute, useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import styles from "./BookingSuccess.style"

export default function BookingSuccess() {
    const route = useRoute()
    const navigation = useNavigation()
    const { data } = route.params || {}

    const handleCall = () => {
        const phoneNumber = data?.roomData?.hotel_user?.hotel_phone
        if (phoneNumber) {
            Linking.openURL(`tel:${phoneNumber}`)
        }
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    }

    const calculateNights = () => {
        const checkIn = new Date(data.checkInDate)
        const checkOut = new Date(data.checkOutDate)
        const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime())
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Success Header */}
                <View style={styles.header}>
                    <Icon name="check-circle" size={80} color="#4CAF50" />
                    <Text style={styles.title}>Booking Confirmed!</Text>
                    <Text style={styles.bookingId}>Booking ID: #{data.Bookingid || "N/A"}</Text>
                </View>

                {/* Hotel Information */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="home" size={24} color="#1a1a1a" />
                        <Text style={styles.sectionTitle}>Hotel Details</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <Image source={{ uri: data.roomData.main_image.url }} style={styles.hotelImage} />
                        <Text style={styles.hotelName}>{data.roomData.hotel_user.hotel_name}</Text>
                        <Text style={styles.hotelAddress}>{data.roomData.hotel_user.hotel_address}</Text>
                    </View>
                </View>

                {/* Stay Details */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="calendar" size={24} color="#1a1a1a" />
                        <Text style={styles.sectionTitle}>Stay Details</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <InfoRow label="Check-in" value={formatDate(data.checkInDate)} />
                        <InfoRow label="Check-out" value={formatDate(data.checkOutDate)} />
                        <InfoRow label="Nights" value={`${calculateNights()} night(s)`} />
                        <InfoRow label="Room Type" value={data.roomData.room_type} />
                        <InfoRow
                            label="Guests"
                            value={`${data.males + data.females} (${data.males} Male, ${data.females} Female)`}
                        />
                    </View>
                </View>

                {/* Guest Information */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="account-group" size={24} color="#1a1a1a" />
                        <Text style={styles.sectionTitle}>Guest Information</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        {data.guestInfo.map((guest, index) => (
                            <View key={guest._id} style={styles.guestItem}>
                                <Text style={styles.guestName}>{guest.guestName}</Text>
                                <Text style={styles.guestDetails}>Age: {guest.guestAge}</Text>
                                {index === 0 && <Text style={styles.guestDetails}>Phone: {guest.guestPhone}</Text>}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Payment Information */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="cash" size={24} color="#1a1a1a" />
                        <Text style={styles.sectionTitle}>Payment Details</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <InfoRow label="Original Price" value={`₹${data.roomData.cut_price}`} />
                        <InfoRow label="Discounted Price" value={`₹${data.roomData.book_price}`} />
                        <InfoRow label="Discount" value={`${data.roomData.discount_percentage}%`} />
                        <InfoRow
                            label="Payment Method"
                            value={data.paymentMethod === "online" ? "Online Payment" : "Pay at Hotel"}
                        />
                    </View>
                </View>

                {/* Contact Section */}
                <View style={styles.contactSection}>
                    <Text style={styles.contactText}>Need assistance? Contact the hotel directly:</Text>
                    <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                        <Icon name="phone" size={24} color="#fff" />
                        <Text style={styles.callButtonText}>Call Hotel</Text>
                    </TouchableOpacity>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate("Home")}>
                        <Text style={styles.homeButtonText}>Back to Home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    )
}

// Helper component for consistent info rows
const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
)

