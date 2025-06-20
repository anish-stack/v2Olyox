import { useState, useMemo, useCallback, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform
} from "react-native"
import { useRoute, useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useFood } from "../../context/Food_Context/Food_context"
import AddressModal from "./AddressModal"
import { useLocation } from "../../context/LocationContext"
import axios from "axios"
import AddOn from "./AddOn"
import { tokenCache } from "../../Auth/cache"
import * as SecureStore from "expo-secure-store"
import { styles } from "./styles"
import EmptyCartMessage from "./EmptyCartMessage"

// Component for each cart item
const CartItem = ({ item, onUpdateQuantity, onRemoveItem }) => {
  const [imageError, setImageError] = useState(false)

  return (
    <View style={styles.cartItem}>
      <Image
        source={imageError ? require("./no-image.jpeg") : { uri: item.images.url }}
        onError={() => setImageError(true)}
        style={styles.foodImage}
      />
      <View style={styles.foodInfo}>
        <Text style={styles.foodName}>{item.food_name}</Text>
        <Text style={styles.foodDescription} numberOfLines={1}>
          {item.food_description || "Delicious food item"}
        </Text>
        <Text style={styles.foodPrice}>₹{(item.food_price * item.quantity).toFixed(2)}</Text>
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          onPress={() => onUpdateQuantity(item._id, item.quantity - 1)}
          style={styles.quantityButton}
        >
          <Icon name="minus" size={16} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity
          onPress={() => onUpdateQuantity(item._id, item.quantity + 1)}
          style={styles.quantityButton}
        >
          <Icon name="plus" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Coupon component
const CouponSection = ({ coupons, couponsLoading, couponsError, totalAmount, selectedCoupon, onSelectCoupon, onRetry }) => {
  if (couponsLoading) {
    return (
      <View style={styles.couponLoadingContainer}>
        <ActivityIndicator size="small" color="#FF5252" />
        <Text style={styles.couponLoadingText}>Loading coupons...</Text>
      </View>
    )
  }

  if (couponsError) {
    return (
      <View style={styles.couponErrorContainer}>
        <Icon name="alert-circle-outline" size={24} color="#FF5252" />
        <Text style={styles.couponErrorText}>{couponsError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (coupons.length === 0) {
    return (
      <View style={styles.noCouponsContainer}>
        <Icon name="ticket-percent-outline" size={24} color="#999" />
        <Text style={styles.noCouponsText}>No coupons available at the moment</Text>
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.couponsScrollContainer}
    >
      {coupons.map((coupon) => {
        const isDisabled = totalAmount < coupon.min_order_amount
        const isSelected = selectedCoupon && selectedCoupon._id === coupon._id

        return (
          <TouchableOpacity
            key={coupon._id}
            style={[
              styles.couponItem,
              isSelected && styles.selectedCoupon,
              isDisabled && styles.disabledCoupon
            ]}
            onPress={() => !isDisabled && onSelectCoupon(coupon)}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            <View style={styles.couponHeader}>
              <Icon name="ticket-percent" size={20} color={isSelected ? "#FF5252" : "#666"} />
              <Text style={[styles.couponTitle, isSelected && styles.selectedCouponText]}>
                {coupon.title}
              </Text>
            </View>

            <View style={[styles.couponBadge, isSelected && styles.selectedCouponBadge]}>
              <Text style={[styles.couponCode, isSelected && styles.selectedCouponCodeText]}>
                {coupon.Coupon_Code}
              </Text>
            </View>

            <View style={styles.couponDetails}>
              <Text style={styles.couponDetailText}>
                {coupon.discount_type === "percentage"
                  ? `${coupon.discount}% off`
                  : `₹${coupon.discount} off`}
              </Text>
              {coupon.max_discount && (
                <Text style={styles.couponDetailText}>Up to ₹{coupon.max_discount}</Text>
              )}
              <Text style={[
                styles.couponMinOrder,
                isDisabled && styles.couponMinOrderHighlight
              ]}>
                Min order: ₹{coupon.min_order_amount}
              </Text>
            </View>

            {isSelected && (
              <View style={styles.appliedTag}>
                <Text style={styles.appliedTagText}>APPLIED</Text>
              </View>
            )}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

// Address section component
const AddressSection = ({ deliveryAddress, onChangeAddress }) => (
  <View style={styles.addressContent}>
    <View style={styles.addressDetails}>
      <View style={styles.addressTypeContainer}>
        <Text style={styles.addressType}>{deliveryAddress.addressType || "Home"}</Text>
        {deliveryAddress.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        )}
      </View>
      <Text style={styles.addressText}>
        {`${deliveryAddress.flatNo}, ${deliveryAddress.street}`}
        {deliveryAddress.landmark ? `, ${deliveryAddress.landmark}` : ""}
        {` - ${deliveryAddress.pincode}`}
      </Text>
    </View>
    <TouchableOpacity style={styles.editAddressButton} onPress={onChangeAddress}>
      <Icon name="pencil" size={18} color="#FF5252" />
    </TouchableOpacity>
  </View>
)

// Payment method component
const PaymentMethodItem = ({ method, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[styles.paymentMethod, isSelected && styles.selectedPayment]}
    onPress={() => onSelect(method.id)}
  >
    <View style={styles.paymentMethodContent}>
      <View style={[
        styles.paymentIconContainer,
        isSelected && styles.selectedPaymentIconContainer,
      ]}>
        <Icon
          name={method.icon}
          size={20}
          color={isSelected ? "#FFFFFF" : "#666"}
        />
      </View>

      <View style={styles.paymentMethodInfo}>
        <Text style={[
          styles.paymentMethodName,
          isSelected && styles.selectedPaymentText
        ]}>
          {method.name}
        </Text>
        <Text style={styles.paymentMethodDescription}>{method.description}</Text>
      </View>
    </View>

    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
      {isSelected && <View style={styles.radioButtonInner} />}
    </View>
  </TouchableOpacity>
)

// Bill details component
const BillDetails = ({ totalAmount, finalAmount, discount, deliveryFee = 40, packagingFee = 15 }) => {
  const taxes = Math.round(totalAmount * 0.05)
  const finalPayableAmount = finalAmount + deliveryFee + packagingFee + taxes

  return (
    <>
      <View style={styles.billItem}>
        <Text style={styles.billItemLabel}>Item Total</Text>
        <Text style={styles.billItemValue}>₹{totalAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.billItem}>
        <Text style={styles.billItemLabel}>Delivery Fee</Text>
        <Text style={styles.billItemValue}>₹{deliveryFee.toFixed(2)}</Text>
      </View>

      <View style={styles.billItem}>
        <Text style={styles.billItemLabel}>Packaging Fee</Text>
        <Text style={styles.billItemValue}>₹{packagingFee.toFixed(2)}</Text>
      </View>

      <View style={styles.billItem}>
        <Text style={styles.billItemLabel}>Taxes</Text>
        <Text style={styles.billItemValue}>₹{taxes.toFixed(2)}</Text>
      </View>

      {discount > 0 && (
        <View style={styles.billItem}>
          <Text style={styles.billItemLabel}>Discount</Text>
          <Text style={styles.discountText}>- ₹{discount.toFixed(2)}</Text>
        </View>
      )}

      <View style={styles.totalItem}>
        <Text style={styles.totalText}>To Pay</Text>
        <Text style={styles.totalValue}>₹{finalPayableAmount.toFixed(2)}</Text>
      </View>

      {discount > 0 && (
        <View style={styles.savingContainer}>
          <Icon name="tag" size={16} color="#4CAF50" />
          <Text style={styles.savingText}>You saved ₹{discount.toFixed(2)} on this order!</Text>
        </View>
      )}
    </>
  )
}

// Main Checkout component
const Checkout = () => {
  const route = useRoute()
  const navigation = useNavigation()
  const { data } = route.params || {}
  const { removeFood, cart: initialItems, updateQuantity, clearCart } = useFood()
  const { total_amount: initialTotalAmount, restaurant } = data || {}
  const { location } = useLocation()

  // State management
  const [token, setToken] = useState(null)
  const [items, setItems] = useState(initialItems)
  const [totalAmount, setTotalAmount] = useState(initialTotalAmount)
  const [selectedCoupon, setSelectedCoupon] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState("CARD")
  const [isLoading, setIsLoading] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState(null)
  const [address, setAddress] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Coupon states
  const [coupons, setCoupons] = useState([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [couponsError, setCouponsError] = useState(null)

  // Load saved address from device storage
  const loadSavedAddress = useCallback(async () => {
    try {
      const savedAddress = await SecureStore.getItemAsync('saved_delivery_address')
      if (savedAddress) {
        setDeliveryAddress(JSON.parse(savedAddress))
      }
    } catch (error) {
      console.log("Error loading saved address:", error)
    }
  }, [])

  // Fetch user's current location and token
  const findCurrent = useCallback(async () => {
    try {
      const data = await axios.post(`http://192.168.1.6:3100/Fetch-Current-Location`, {
        lat: location?.coords?.latitude,
        lng: location?.coords?.longitude,
      })
      setAddress(data.data.data.address)

      const gmail_token = await tokenCache.getToken("auth_token")
      const db_token = await tokenCache.getToken("auth_token_db")
      const _token = db_token || gmail_token
      setToken(_token)
    } catch (error) {
      console.log("Location fetch error:", error)
    }
  }, [location])

  // Fetch available coupons
  const fetchCoupons = useCallback(async () => {
    setCouponsLoading(true)
    setCouponsError(null)
    try {
      const response = await axios.get("http://192.168.1.6:3100/api/v1/tiffin/tiffin-coupons")
      if (response.data.success) {
        // Filter only active coupons
        const activeCoupons = response.data.data.filter((coupon) => coupon.active)
        setCoupons(activeCoupons)
      } else {
        setCouponsError("Failed to load coupons")
      }
    } catch (error) {
      console.error("Coupon fetch error:", error)
      setCouponsError("Network error. Please try again.")
    } finally {
      setCouponsLoading(false)
    }
  }, [])

  useEffect(() => {
    findCurrent()
    fetchCoupons()
    loadSavedAddress()
  }, [findCurrent, fetchCoupons, loadSavedAddress])

  // Update total amount when items change
  useEffect(() => {
    updateTotalAmount()
  }, [items])

  const updateTotalAmount = useCallback(() => {
    if (!items || items.length === 0) return
    const newTotal = items.reduce((sum, item) => sum + item.food_price * item.quantity, 0)
    setTotalAmount(newTotal)
  }, [items])

  // Handle quantity updates with useCallback for performance
  const handleUpdateQuantity = useCallback(
    (itemId, newQuantity) => {
      if (newQuantity < 1) {
        handleRemoveItem(itemId)
        return
      }

      const updatedItems = items?.map((item) => (item._id === itemId ? { ...item, quantity: newQuantity } : item))
      setItems(updatedItems)
      updateQuantity(itemId, newQuantity)
    },
    [items, updateQuantity],
  )

  // Handle item removal with useCallback
  const handleRemoveItem = useCallback(
    (itemId) => {
      const updatedItems = items.filter((item) => item._id !== itemId)
      setItems(updatedItems)
      removeFood(itemId)
    },
    [items, removeFood],
  )

  // Calculate discount with useMemo for performance
  const calculateDiscount = useMemo(() => {
    if (!selectedCoupon || totalAmount < selectedCoupon.min_order_amount) return 0

    const { discount_type, max_discount, discount } = selectedCoupon

    if (discount_type === "percentage") {
      const discountAmount = totalAmount * (discount / 100)
      return max_discount ? Math.min(discountAmount, max_discount) : discountAmount
    }

    return discount || 0
  }, [selectedCoupon, totalAmount])

  // Calculate final amount with useMemo
  const finalAmount = useMemo(() => {
    return totalAmount - calculateDiscount
  }, [totalAmount, calculateDiscount])

  // Handle coupon selection
  const handleSelectCoupon = useCallback(
    (coupon) => {
      if (selectedCoupon && selectedCoupon._id === coupon._id) {
        // If the same coupon is selected, deselect it
        setSelectedCoupon(null)
        Alert.alert("Coupon Removed", "Coupon has been removed successfully")
      } else {
        // Otherwise, select the new coupon
        setSelectedCoupon(coupon)
        Alert.alert("Coupon Applied", `${coupon.Coupon_Code} applied successfully!`)
      }
    },
    [selectedCoupon],
  )

  // Save address to device storage
  const saveAddressToDevice = useCallback(async (address) => {
    try {
      await SecureStore.setItemAsync('saved_delivery_address', JSON.stringify(address))
    } catch (error) {
      console.log("Error saving address:", error)
    }
  }, [])

  // Handle address selection
  const handleAddressSelect = useCallback((address) => {
    setDeliveryAddress(address)
    saveAddressToDevice(address)
    setShowAddressModal(false)
  }, [saveAddressToDevice])

  // Show order confirmation
  const showOrderConfirmation = useCallback(() => {
    if (!deliveryAddress) {
      setShowAddressModal(true)
      return
    }

    setShowConfirmation(true)
  }, [deliveryAddress])

  // Handle place order
  const handlePlaceOrder = useCallback(async () => {
    if (!token) {
      const gmail_token = await tokenCache.getToken("auth_token")
      const db_token = await tokenCache.getToken("auth_token_db")
      const _token = db_token || gmail_token
      setToken(_token)
    }

    setIsLoading(true)

    try {
      const response = await axios.post(
        `http://192.168.1.6:3100/api/v1/tiffin/create_order_of_food`,
        {
          order_items: items,
          orderId: "ORD" + Math.floor(Math.random() * 1000000),
          deliveryAddress,
          paymentMethod,
          total_payable: finalAmount,
          coupon_applied: selectedCoupon,
          user_lat: location?.coords?.latitude,
          user_lng: location?.coords?.longitude,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response && response.data && response.data.orderDetails) {
        await SecureStore.setItemAsync("ongoing_order", JSON.stringify([response.data.orderDetails]))
        clearCart()
        navigation.navigate("Order_Process", {
          order_id: response.data.orderDetails,
        })

        Alert.alert(
          "Order Placed Successfully!",
          "Your order has been placed successfully. You will receive updates soon.",
          [{ text: "OK" }],
        )
      } else {
        throw new Error("Order details are missing in the response.")
      }
    } catch (error) {
      console.error("Order placement error:", error)
      const errorMessage = error.response?.data?.message || error.message || "An unexpected error occurred."

      Alert.alert("Order Failed!", errorMessage, [{ text: "OK" }])
    } finally {
      setIsLoading(false)
      setShowConfirmation(false)
    }
  }, [token, deliveryAddress, items, paymentMethod, finalAmount, selectedCoupon, location, navigation])

  // Payment methods data
  const paymentMethods = [
    {
      id: "CARD",
      name: "Online Payment",
      icon: "credit-card",
      description: "Pay securely with credit/debit card or UPI To direct to resturant After complete order",
    },
    {
      id: "COD",
      name: "Cash on Delivery",
      icon: "cash",
      description: "Pay when your order arrives",
    },
  ]

  // Render confirmation modal
  const renderConfirmationModal = () => {
    if (!showConfirmation) return null;

    const deliveryFee = 40;
    const packagingFee = 15;
    const taxes = Math.round(totalAmount * 0.05);
    const finalPayableAmount = finalAmount + deliveryFee + packagingFee + taxes;

    return (
      <View style={styles.confirmationOverlay}>
        <View style={styles.confirmationModal}>
          <View style={styles.confirmationHeader}>
            <Text style={styles.confirmationTitle}>Confirm Your Order</Text>
            <TouchableOpacity onPress={() => setShowConfirmation(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.confirmationContent}>
            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>Delivery Address</Text>
              <Text style={styles.confirmationAddress}>
                {`${deliveryAddress.flatNo}, ${deliveryAddress.street}`}
                {deliveryAddress.landmark ? `, ${deliveryAddress.landmark}` : ""}
                {` - ${deliveryAddress.pincode}`}
              </Text>
            </View>

            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>Payment Method</Text>
              <Text style={styles.confirmationPayment}>
                {paymentMethod === "CARD" ? "Online Payment" : "Cash on Delivery"}
              </Text>
            </View>

            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>Order Summary</Text>
              {items.map(item => (
                <View key={item._id} style={styles.confirmationItem}>
                  <Text style={styles.confirmationItemName}>
                    {item.food_name} x {item.quantity}
                  </Text>
                  <Text style={styles.confirmationItemPrice}>
                    ₹{(item.food_price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>Bill Details</Text>
              <View style={styles.confirmationBillItem}>
                <Text>Item Total</Text>
                <Text>₹{totalAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.confirmationBillItem}>
                <Text>Delivery Fee</Text>
                <Text>₹{deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={styles.confirmationBillItem}>
                <Text>Packaging Fee</Text>
                <Text>₹{packagingFee.toFixed(2)}</Text>
              </View>
              <View style={styles.confirmationBillItem}>
                <Text>Taxes</Text>
                <Text>₹{taxes.toFixed(2)}</Text>
              </View>
              {calculateDiscount > 0 && (
                <View style={styles.confirmationBillItem}>
                  <Text>Discount</Text>
                  <Text style={styles.discountText}>- ₹{calculateDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.confirmationTotal}>
                <Text style={styles.confirmationTotalText}>Total Amount</Text>
                <Text style={styles.confirmationTotalValue}>₹{finalPayableAmount.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.confirmationActions}>
            <TouchableOpacity
              style={styles.confirmationCancelButton}
              onPress={() => setShowConfirmation(false)}
            >
              <Text style={styles.confirmationCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmationConfirmButton}
              onPress={handlePlaceOrder}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmationConfirmText}>Confirm Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (initialItems.length === 0) {
    return <EmptyCartMessage />
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={Platform.OS === 'ios' ? "dark-content" : "light-content"} backgroundColor="#FF5252" />
      <View style={styles.container}>
        {/* Header */}
        {Platform.OS === "ios" && (
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={styles.headerRight} />
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Restaurant Info */}
          <View style={styles.restaurantContainer}>
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName}>
                {restaurant?.restaurant_name || "Restaurant Name"}
              </Text>
              <Text style={styles.restaurantAddress}>
                {restaurant?.restaurant_address
                  ? `${restaurant.restaurant_address.street || ''}, ${restaurant.restaurant_address.city || ''}`
                  : "Restaurant Address"}
              </Text>
            </View>
            <View style={styles.deliveryTimeContainer}>
              <Icon name="clock-outline" size={16} color="#666" />
              <Text style={styles.deliveryTimeText}>25-30 min</Text>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.cartContainer}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="food" size={22} color="#FF5252" />
              <Text style={styles.sectionTitle}>Your Order</Text>
              <Text style={styles.itemCount}>
                ({items?.length || 0} {items?.length === 1 ? "item" : "items"})
              </Text>
            </View>
            {items?.map(item => (
              <CartItem
                key={item._id}
                item={item}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            ))}
          </View>

          {/* Delivery Address */}
          <View style={styles.addressContainer}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="map-marker" size={22} color="#FF5252" />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>

            {deliveryAddress ? (
              <AddressSection
                deliveryAddress={deliveryAddress}
                onChangeAddress={() => setShowAddressModal(true)}
              />
            ) : (
              <TouchableOpacity
                style={styles.addAddressButton}
                onPress={() => setShowAddressModal(true)}
              >
                <Icon name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.addAddressText}>Add Delivery Address</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Coupons */}
          <View style={styles.couponsContainer}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="ticket-percent" size={22} color="#FF5252" />
              <Text style={styles.sectionTitle}>Available Coupons</Text>
            </View>
            <CouponSection
              coupons={coupons}
              couponsLoading={couponsLoading}
              couponsError={couponsError}
              totalAmount={totalAmount}
              selectedCoupon={selectedCoupon}
              onSelectCoupon={handleSelectCoupon}
              onRetry={fetchCoupons}
            />
          </View>

          {/* Add-ons */}
          <AddOn restaurant_id={restaurant} />

          {/* Payment Methods */}
          <View style={styles.paymentMethodsContainer}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="wallet" size={22} color="#FF5252" />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>

            {paymentMethods.map((method) => (
              <PaymentMethodItem
                key={method.id}
                method={method}
                isSelected={paymentMethod === method.id}
                onSelect={setPaymentMethod}
              />
            ))}
          </View>

          {/* Bill Details */}
          <View style={styles.billDetailsContainer}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="receipt" size={22} color="#FF5252" />
              <Text style={styles.sectionTitle}>Bill Details</Text>
            </View>
            <BillDetails
              totalAmount={totalAmount}
              finalAmount={finalAmount}
              discount={calculateDiscount}
            />
          </View>
        </ScrollView>

        {/* Checkout Button */}
        <View style={styles.checkoutButtonContainer}>
          <View style={styles.checkoutSummary}>
            <View>
              <Text style={styles.checkoutTotalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                ₹{(finalAmount + 40 + 15 + Math.round(totalAmount * 0.05)).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutButton, (!deliveryAddress || isLoading) && styles.disabledButton]}
              onPress={showOrderConfirmation}
              disabled={!deliveryAddress || isLoading}
            >
              <Text style={styles.checkoutButtonText}>Place Order</Text>
              <Icon name="arrow-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Address Modal */}
        <AddressModal
          visible={showAddressModal}
          location_data={address}
          onClose={() => setShowAddressModal(false)}
          onSave={handleAddressSelect}
        />

        {/* Confirmation Modal */}
        {renderConfirmationModal()}
      </View>
    </SafeAreaView>
  )
}

export default Checkout
