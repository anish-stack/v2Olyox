"use client"

import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  TextInput,
  StatusBar,
} from "react-native"
import RazorpayCheckout from "react-native-razorpay"
import axios from "axios"
import * as SecureStore from "expo-secure-store"
import { useNavigation, useRoute } from "@react-navigation/native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import { LinearGradient } from "expo-linear-gradient"
import useGetCoupons from "../../hooks/GetUnlockCopons"

const { width } = Dimensions.get("window")

// Payment Status Modal Component
const PaymentStatusModal = ({ visible, status, message, onClose }) => {
  const [scaleAnim] = useState(new Animated.Value(0))

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start()
    } else {
      scaleAnim.setValue(0)
    }
  }, [visible])

  const getStatusConfig = () => {
    switch (status) {
      case "success":
        return {
          icon: "check-circle",
          color: "#10B981",
          title: "Payment Successful!",
          gradient: ["#10B981", "#059669"],
        }
      case "failed":
        return {
          icon: "close-circle",
          color: "#EF4444",
          title: "Payment Failed",
          gradient: ["#EF4444", "#DC2626"],
        }
      case "cancelled":
        return {
          icon: "cancel",
          color: "#F59E0B",
          title: "Payment Cancelled",
          gradient: ["#F59E0B", "#D97706"],
        }
      default:
        return {
          icon: "information",
          color: "#3B82F6",
          title: "Payment Status",
          gradient: ["#3B82F6", "#2563EB"],
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={config.gradient}
            style={styles.modalHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name={config.icon} size={50} color="#FFF" />
            <Text style={styles.modalTitle}>{config.title}</Text>
          </LinearGradient>

          <View style={styles.modalBody}>
            <Text style={styles.modalMessage}>{message}</Text>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: config.color }]} onPress={onClose}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

// Coupon Modal Component
const CouponModal = ({ visible, onClose, couponCode, setCouponCode, validateCoupon, error, loading }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.couponModalContent}>
          <View style={styles.couponModalHeader}>
            <Text style={styles.couponModalTitle}>Apply Coupon</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.couponInputContainer}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter coupon code"
              value={couponCode}
              onChangeText={setCouponCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.applyCouponButton} onPress={validateCoupon} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.applyCouponButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.couponErrorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// Membership Plan Card Component
const MembershipCard = ({ plan, selected, onSelect, showEarnings = false }) => {
  const validityText =
    plan.validityDays === 1 ? `${plan.validityDays} ${plan.whatIsThis}` : `${plan.validityDays} ${plan.whatIsThis}s`

  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.selectedPlan]}
      onPress={() => onSelect(plan._id)}
      activeOpacity={0.7}
    >
      {plan.isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Popular</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Icon name={selected ? "check-circle" : "circle-outline"} size={24} color={selected ? "#10B981" : "#6B7280"} />
      </View>

      <View style={styles.priceContainer}>
        <Text style={styles.planPrice}>₹{plan.price}</Text>
        <Text style={styles.gstText}>+18% GST</Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.planDescription}>{plan.description}</Text>

      <View style={styles.planDetailsContainer}>
        <View style={styles.planDetailItem}>
          <Icon name="clock-outline" size={16} color="#6B7280" />
          <Text style={styles.planDetailText}>Valid for {validityText}</Text>
        </View>

        {showEarnings && plan.HowManyMoneyEarnThisPlan && (
          <View style={styles.planDetailItem}>
            <Icon name="cash-multiple" size={16} color="#10B981" />
            <Text style={styles.planDetailText}>Earn up to ₹{plan.HowManyMoneyEarnThisPlan}</Text>
          </View>
        )}

        {plan.includes && plan.includes.length > 0 && (
          <View style={styles.planDetailItem}>
            <Icon name="check-circle-outline" size={16} color="#10B981" />
            <Text style={styles.planDetailText}>Includes: {plan.includes.join(", ")}</Text>
          </View>
        )}
      </View>

      {showEarnings && plan.HowManyMoneyEarnThisPlan && (
        <View style={styles.earningNoteContainer}>
          <Text style={styles.earningNoteText}>
            *After earning ₹{plan.HowManyMoneyEarnThisPlan}, this recharge will expire
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function RechargeViaOnline() {
  const navigation = useNavigation()
  const route = useRoute()
  const { showOnlyBikePlan, role, firstRecharge } = route.params || {}
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    status: "",
    message: "",
  })
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [couponError, setCouponError] = useState("")
  const { coupons, loading: couponsLoading, refresh: refreshCoupons } = useGetCoupons()

  // Get selected plan details
  const selectedPlan = memberships.find((plan) => plan._id === selectedMemberId)

  useEffect(() => {
    fetchUserDetails()
    fetchMembershipPlans()
    refreshCoupons()
  }, [])

  const fetchUserDetails = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab")
      if (!token) throw new Error("Authentication token not found")

      const response = await axios.get("http://192.168.1.6:3100/api/v1/rider/user-details", {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUserData(response.data.partner)
    } catch (error) {
      showPaymentModal("failed", "Failed to fetch user details. Please try again.")
    }
  }

  const fetchMembershipPlans = async () => {
    try {
      const { data } = await axios.get("https://www.api.olyox.com/api/v1/membership-plans")

      let plans = data.data.filter((item) => item.category === (showOnlyBikePlan ? "bike" : role))

      // Filter based on firstRecharge condition
      if (firstRecharge) {
        plans = plans.filter((plan) => plan.price >= 1)
      }

      setMemberships(plans)

      // Select the first plan by default if available
      if (plans.length > 0 && !selectedMemberId) {
        setSelectedMemberId(plans[0]._id)
      }
    } catch (error) {
      showPaymentModal("failed", "Failed to fetch membership plans. Please try again.")
    }
  }

  const showPaymentModal = (status, message) => {
    setModalConfig({
      visible: true,
      status,
      message,
    })
  }

  // Validate coupon
  const validateCoupon = useCallback(() => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code")
      return
    }

    setValidatingCoupon(true)
    setCouponError("")

    try {
      // Find the coupon in available coupons
      const foundCoupon = coupons?.find(
        (coupon) => coupon.code.toLowerCase() === couponCode.trim().toLowerCase() && coupon.isActive,
      )

      if (foundCoupon) {
        setAppliedCoupon(foundCoupon)
        setShowCouponModal(false)
        Alert.alert(
          "Coupon Applied",
          `Coupon "${foundCoupon.code}" for ${foundCoupon.discount}% discount has been applied!`,
        )
      } else {
        setCouponError("Invalid coupon code or coupon has expired")
      }
    } catch (error) {
      console.error("Error validating coupon:", error)
      setCouponError("An error occurred while validating the coupon")
    } finally {
      setValidatingCoupon(false)
    }
  }, [couponCode, coupons])

  // Remove applied coupon
  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null)
    setCouponCode("")
  }, [])

  // Calculate discounted price
  const calculateDiscountedPrice = useCallback(() => {
    if (!selectedPlan) return { basePrice: 0, gstAmount: 0, totalPrice: 0 };

    try {
      let basePrice = selectedPlan.price;

      if (appliedCoupon) {
        const discountAmount = (selectedPlan.price * appliedCoupon.discount) / 100;
        basePrice = selectedPlan.price - discountAmount;
      }

      const gstAmount = basePrice * 0.18;
      const totalPrice = basePrice + gstAmount;

      return {
        basePrice: Number.parseFloat(basePrice.toFixed(2)),
        gstAmount: Number.parseFloat(gstAmount.toFixed(2)),
        totalPrice: Number.parseFloat(totalPrice.toFixed(2))
      };
    } catch (error) {
      console.error("Error calculating price:", error);
      return { basePrice: 0, gstAmount: 0, totalPrice: 0 };
    }
  }, [selectedPlan, appliedCoupon]);

  const { basePrice, gstAmount, totalPrice } = calculateDiscountedPrice();


  const initiatePayment = async () => {
    if (!selectedMemberId) {
      showPaymentModal("failed", "Please select a membership plan.")
      return
    }

    setLoading(true)
    const baseUrl = `http://192.168.1.6:3100/api/v1/rider/recharge-wallet/${selectedMemberId}/${userData?.BH}`
    const urlWithParams = appliedCoupon ? `${baseUrl}?coupon=${appliedCoupon.code}&type=cab` : baseUrl

    try {
      const response = await axios.get(urlWithParams)

      const options = {
        description: "Recharge Wallet",
        image: "https://www.olyox.com/assets/logo-CWkwXYQ_.png",
        currency: response.data.order.currency,
        key: "rzp_live_zD1yAIqb2utRwp",
        amount: response.data.order.amount,
        name: "Olyox",
        order_id: response.data.order.id,
        prefill: {
          email: userData?.email,
          contact: userData?.phone,
          name: userData?.name,
        },
        theme: { color: "#10B981" },
      }

      // Razorpay opens and resolves on success
      const paymentResponse = await RazorpayCheckout.open(options)
      console.log("Payment Success Response:", paymentResponse)

      // After payment, call your backend verification API
      const verifyResponse = await axios.post(
        `http://192.168.1.6:3100/api/v1/rider/recharge-verify/${userData?.BH}`,
        {
          razorpay_order_id: paymentResponse?.razorpay_order_id,
          razorpay_payment_id: paymentResponse?.razorpay_payment_id,
          razorpay_signature: paymentResponse?.razorpay_signature,
        },
      )

      const rechargeStatus = verifyResponse?.data?.rechargeData

      if (verifyResponse?.data?.message?.includes("successful") && rechargeStatus?.payment_approved) {
        showPaymentModal("success", "Your payment was successful! Your membership has been activated.")
        setTimeout(() => {
          navigation.navigate("Home")
        }, 2000)
      } else {
        showPaymentModal("failed", "Payment processed but verification failed. Please contact support.")
      }
    } catch (error) {
      console.log("Payment Error:", error.response?.data || error)

      if (error?.description === "Payment Cancelled" || error?.code === "PAYMENT_CANCELLED") {
        showPaymentModal("cancelled", "You cancelled the payment. Please try again when you're ready.")
      } else {
        showPaymentModal("failed", "Payment failed. Please try again or contact support.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#059669" barStyle="light-content" />
      {/* Header with gradient background */}
      <LinearGradient colors={["#10B981", "#059669"]} style={styles.headerGradient}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Membership Plans</Text>
          <Text style={styles.headerSubtitle}>Boost your earnings with premium benefits</Text>

          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <Icon name="clock-check-outline" size={20} color="#FFFFFF" />
              <Text style={styles.benefitText}>Priority Bookings</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="percent" size={20} color="#FFFFFF" />
              <Text style={styles.benefitText}>0% Commission</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="headset" size={20} color="#FFFFFF" />
              <Text style={styles.benefitText}>Premium Support</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Plan selection section */}
      <ScrollView contentContainerStyle={styles.planContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Your Plan</Text>
          <Text style={styles.sectionSubtitle}>Choose a plan that suits your needs</Text>
        </View>

        {memberships.map((plan) => (
          <MembershipCard
            key={plan._id}
            plan={plan}
            selected={plan._id === selectedMemberId}
            onSelect={(id) => setSelectedMemberId(id)}
            showEarnings={true}
          />
        ))}
      </ScrollView>

      {/* Bottom action section */}
      {selectedPlan && (
        <View style={styles.bottomSection}>
          {/* Coupon section - only show if plan price > 1 */}
          {selectedPlan.price > 1 && (
            <View style={styles.couponSection}>
              {appliedCoupon ? (
                <View style={styles.appliedCouponContainer}>
                  <View style={styles.appliedCouponInfo}>
                    <Icon name="tag" size={20} color="#10B981" />
                    <Text style={styles.appliedCouponText}>
                      {appliedCoupon.code} ({appliedCoupon.discount}% OFF)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={removeCoupon}>
                    <Icon name="close-circle" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.couponButton} onPress={() => setShowCouponModal(true)}>
                  <Icon name="tag-outline" size={20} color="#10B981" />
                  <Text style={styles.couponButtonText}>Apply Coupon</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Price and payment button */}
          <View style={styles.paymentSection}>
            <View style={styles.priceBreakdown}>
              <Text style={styles.totalPriceLabel}>Total Price:</Text>
              <View style={styles.priceDisplay}>
                {appliedCoupon && (
                  <Text style={styles.originalPrice}>₹{selectedPlan.price.toFixed(2)}</Text>
                )}
                <Text style={styles.finalPrice}>
                  ₹{basePrice} + 18% GST = ₹{totalPrice}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.paymentButton} onPress={initiatePayment} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="credit-card-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.paymentButtonText}>Pay Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals */}
      <PaymentStatusModal
        visible={modalConfig.visible}
        status={modalConfig.status}
        message={modalConfig.message}
        onClose={() => setModalConfig({ ...modalConfig, visible: false })}
      />

      <CouponModal
        visible={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        validateCoupon={validateCoupon}
        error={couponError}
        loading={validatingCoupon}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  headerContent: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
    textAlign: "center",
  },
  benefitsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    width: "100%",
  },
  benefitItem: {
    alignItems: "center",
  },
  benefitText: {
    color: "#FFFFFF",
    marginTop: 4,
    fontSize: 12,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  planContainer: {
    padding: 16,
    paddingBottom: 120, // Extra padding for bottom section
  },
  planCard: {

    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 60,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: "relative",
  },
  selectedPlan: {
    borderWidth: 2,
    borderColor: "#10B981",
  },
  popularBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  priceContainer: {
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
  },
  gstText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  planDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 16,
  },
  planDetailsContainer: {
    gap: 8,
  },
  planDetailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  planDetailText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  earningNoteContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
  },
  earningNoteText: {
    fontSize: 12,
    color: "#059669",
    fontStyle: "italic",
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  couponSection: {
    marginBottom: 16,
  },
  couponButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderStyle: "dashed",
  },
  couponButtonText: {
    marginLeft: 8,
    color: "#10B981",
    fontWeight: "500",
  },
  appliedCouponContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
  },
  appliedCouponInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  appliedCouponText: {
    marginLeft: 8,
    color: "#10B981",
    fontWeight: "500",
  },
  paymentSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceBreakdown: {
    flex: 1,
  },
  totalPriceLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  priceDisplay: {
    flexDirection: "row",
    alignItems: "center",
  },
  originalPrice: {
    fontSize: 16,
    color: "#6B7280",
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  finalPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  paymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 140,
  },
  paymentButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 12,
  },
  modalBody: {
    padding: 20,
  },
  modalMessage: {
    fontSize: 16,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  couponModalContent: {
    width: width * 0.85,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  couponModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  couponModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  couponInputContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  applyCouponButton: {
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  applyCouponButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  couponErrorText: {
    color: "#EF4444",
    marginBottom: 16,
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  closeButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
  },
})
