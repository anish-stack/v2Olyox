"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native"
import { useRoute } from "@react-navigation/native"
import { API_URL_V1, COLORS, SIZES, WEIGHTS, SPACING, RADIUS } from "../../constants/Google"
import axios from "axios"
import { FontAwesome, MaterialIcons, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import * as SecureStore from "expo-secure-store"
import { checkBhDetails } from "../../utils/Api"

export default function Withdraw() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawals, setWithdrawals] = useState([])
  const [errors, setErrors] = useState({})
  const [checkBhData, setBhData] = useState(null)
  const [tdsData, setTdsData] = useState(null)
  const [fetchingTds, setFetchingTds] = useState(false)

  const [serverErrors, setServerErrors] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const route = useRoute()
  const { _id, wallet } = route.params || { _id: "user123" }

  const [formData, setFormData] = useState({
    amount: "",
    method: "UPI",
    isBank: false,
    isUpi: true,
    BankDetails: {
      accountNo: "",
      ifsc_code: "",
      bankName: "",
    },
    upi_details: {
      upi_id: "",
    },
  })

  useEffect(() => {
    fetchUserDetails()
    fetchWithdrawals()
    fetchTdsData()
  }, [])

  const fetchTdsData = async () => {
    setFetchingTds(true)
    try {
      const response = await axios.get(
        "https://www.webapi.olyox.com/api/v1/get_single_commission_tds/681fa157d45bee7fc60813cb",
      )
      if (response.data.success) {
        setTdsData(response.data.data)
      }
    } catch (error) {
      console.error("Error fetching TDS data:", error)
    } finally {
      setFetchingTds(false)
    }
  }

  const fetchUserDetails = async () => {
    setLoading(true)
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab")
      if (token) {
        const response = await axios.get("http://192.168.1.6:3100/api/v1/rider/user-details", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.data.partner) {
          try {
            const data = await checkBhDetails(response.data.partner?.BH)
            if (data.complete) {
              setBhData(data.complete)
            }
          } catch (error) {
            console.log("BH Found Error", error)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user details:", error?.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchWithdrawals = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL_V1}/withdrawal?_id=${_id}`)
      setWithdrawals(response.data.withdrawal || [])

      // Set last used method and details if available
      if (response.data.withdrawal && response.data.withdrawal.length > 0) {
        const lastWithdrawal = response.data.withdrawal[0]
        const isBank = lastWithdrawal.method === "Bank Transfer"
        setFormData((prev) => ({
          ...prev,
          method: lastWithdrawal.method,
          isBank: isBank,
          isUpi: !isBank,
          BankDetails: isBank
            ? {
                accountNo: lastWithdrawal.BankDetails?.accountNo || "",
                ifsc_code: lastWithdrawal.BankDetails?.ifsc_code || "",
                bankName: lastWithdrawal.BankDetails?.bankName || "",
              }
            : prev.BankDetails,
          upi_details: !isBank
            ? {
                upi_id: lastWithdrawal.upi_details?.upi_id || "",
              }
            : prev.upi_details,
        }))
      }
    } catch (error) {
      console.error("Error fetching withdrawals:", error)
      Alert.alert("Error", "Failed to load withdrawal history")
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Please enter a valid amount"
    }

    if (formData.isBank) {
      if (!formData.BankDetails.accountNo || !/^\d{9,18}$/.test(formData.BankDetails.accountNo)) {
        newErrors.accountNo = "Please enter a valid account number (9-18 digits)"
      }
      if (!formData.BankDetails.ifsc_code || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.BankDetails.ifsc_code)) {
        newErrors.ifsc_code = "Please enter a valid IFSC code"
      }
      if (!formData.BankDetails.bankName) {
        newErrors.bankName = "Please enter bank name"
      }
    }

    if (formData.isUpi) {
      if (!formData.upi_details.upi_id || !/^[\w.-]+@[\w.-]+$/.test(formData.upi_details.upi_id)) {
        newErrors.upi_id = "Please enter a valid UPI ID"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (name, value) => {
    setErrors((prev) => ({ ...prev, [name]: "" }))
    setServerErrors(null)

    if (["accountNo", "ifsc_code", "bankName"].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        BankDetails: {
          ...prev.BankDetails,
          [name]: value,
        },
      }))
    } else if (name === "upi_id") {
      setFormData((prev) => ({
        ...prev,
        upi_details: {
          ...prev.upi_details,
          upi_id: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleMethodChange = (method) => {
    setFormData((prev) => ({
      ...prev,
      method: method === "Bank" ? "Bank Transfer" : "UPI",
      isBank: method === "Bank",
      isUpi: method === "UPI",
    }))
    setErrors({})
    setServerErrors(null)
  }

  const calculateDeductions = () => {
    if (!formData.amount || isNaN(Number.parseFloat(formData.amount)) || !tdsData) {
      return { commission: 0, tds: 0, finalAmount: 0 }
    }

    const amount = Number.parseFloat(formData.amount)
    const commissionPercentage = tdsData.withdrawCommision || 0
    const tdsPercentage = tdsData.isActive ? tdsData.tdsPercentage || 0 : 0

    const commission = (amount * commissionPercentage) / 100
    const tds = (amount * tdsPercentage) / 100
    const finalAmount = amount - commission - tds

    return {
      commission,
      tds,
      finalAmount,
    }
  }

  const { commission, tds, finalAmount } = calculateDeductions()

  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      // For demo purposes, we're just logging the data
      console.log("Submitting withdrawal request:", formData)

      // Uncomment this for actual API call
      const response = await axios.post(`${API_URL_V1}/create-withdrawal?_id=${_id}`, formData)
      console.log("response", response.data)
      // Simulate API response
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setSubmitting(false)
      Alert.alert("Success", "Your withdrawal request has been submitted successfully!", [
        { text: "OK", onPress: () => setShowModal(false) },
      ])

      // Refresh withdrawals list
      fetchUserDetails()
      fetchWithdrawals()
    } catch (error) {
      setServerErrors(error?.response?.data?.message || "An error occurred while processing your request")
      console.error("Error creating withdrawal:", error?.response?.data?.message || error)
    } finally {
      setSubmitting(false)
    }
  }

  const renderWithdrawalHistory = () => {
    if (withdrawals.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="history" size={60} color={COLORS.lightGray} />
          <Text style={styles.emptyStateText}>No withdrawal history found</Text>
        </View>
      )
    }

    return withdrawals.map((item, index) => (
      <View key={index} style={styles.historyItem}>
        <View style={styles.historyItemHeader}>
          <View style={styles.historyItemLeft}>
            <MaterialIcons
              name={item.method === "UPI" ? "payment" : "account-balance"}
              size={24}
              color={COLORS.primary}
            />
            <View style={styles.historyItemDetails}>
              <Text style={styles.historyItemMethod}>{item.method}</Text>
              <Text style={styles.historyItemDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.status === "Completed"
                ? styles.successBadge
                : item.status === "Pending"
                  ? styles.pendingBadge
                  : styles.rejectedBadge,
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.historyItemBody}>
          <Text style={styles.amountText}>₹{Number.parseFloat(item.amount).toFixed(2)}</Text>
          {item.method === "UPI" && <Text style={styles.detailText}>UPI: {item.upi_details?.upi_id}</Text>}
          {item.method === "Bank Transfer" && (
            <>
              <Text style={styles.detailText}>Bank: {item.BankDetails?.bankName}</Text>
              <Text style={styles.detailText}>
                A/C: {item.BankDetails?.accountNo?.replace(/(\d{4})(\d+)(\d{4})/, "$1****$3")}
              </Text>
            </>
          )}
        </View>
      </View>
    ))
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <LinearGradient colors={[COLORS.primary, "#8A84FF"]} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Withdraw Funds</Text>
          <FontAwesome name="money" size={24} color={COLORS.light} />
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₹{checkBhData?.wallet || wallet || 0}</Text>
          <TouchableOpacity style={styles.withdrawButton} onPress={() => setShowModal(true)}>
            <Text style={styles.withdrawButtonText}>Withdraw Now</Text>
            <MaterialIcons name="arrow-forward" size={18} color={COLORS.light} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Withdrawal History</Text>
            <TouchableOpacity onPress={fetchWithdrawals}>
              <Ionicons name="refresh" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : (
            <View style={styles.historyList}>{renderWithdrawalHistory()}</View>
          )}
        </View>
      </ScrollView>

      {showModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Withdrawal</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {serverErrors && (
              <View style={styles.serverError}>
                <MaterialIcons name="error" size={20} color={COLORS.light} />
                <Text style={styles.serverErrorText}>{serverErrors}</Text>
              </View>
            )}

            <ScrollView style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputPrefix}>₹</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter amount"
                    keyboardType="numeric"
                    value={formData.amount}
                    onChangeText={(value) => handleInputChange("amount", value)}
                  />
                </View>
                {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
              </View>

              {/* TDS and Commission Calculation Section */}
              {formData.amount &&
                !isNaN(Number.parseFloat(formData.amount)) &&
                Number.parseFloat(formData.amount) > 0 && (
                  <View style={styles.calculationCard}>
                    <Text style={styles.calculationTitle}>Withdrawal Breakdown</Text>

                    <View style={styles.calculationRow}>
                      <Text style={styles.calculationLabel}>Requested Amount</Text>
                      <Text style={styles.calculationValue}>₹{Number.parseFloat(formData.amount).toFixed(2)}</Text>
                    </View>

                    <View style={styles.calculationRow}>
                      <Text style={styles.calculationLabel}>Platform Fee ({tdsData?.withdrawCommision || 0}%)</Text>
                      <Text style={styles.calculationValueNegative}>- ₹{commission.toFixed(2)}</Text>
                    </View>

                    {tdsData?.isActive && (
                      <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>TDS ({tdsData?.tdsPercentage || 0}%)</Text>
                        <Text style={styles.calculationValueNegative}>- ₹{tds.toFixed(2)}</Text>
                      </View>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.calculationRow}>
                      <Text style={styles.calculationTotal}>You Will Receive</Text>
                      <Text style={styles.calculationTotalValue}>₹{finalAmount.toFixed(2)}</Text>
                    </View>

                    <View style={styles.infoContainer}>
                      <MaterialIcons name="info-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.infoText}>
                        {tdsData?.isActive
                          ? "TDS (Tax Deducted at Source) will be deducted as per government regulations."
                          : "Platform fee will be deducted from your withdrawal amount."}
                      </Text>
                    </View>
                  </View>
                )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Payment Method</Text>
                <View style={styles.methodSelector}>
                  <TouchableOpacity
                    style={[styles.methodOption, formData.isUpi && styles.methodOptionActive]}
                    onPress={() => handleMethodChange("UPI")}
                  >
                    <MaterialIcons name="payment" size={24} color={formData.isUpi ? COLORS.light : COLORS.primary} />
                    <Text style={[styles.methodText, formData.isUpi && styles.methodTextActive]}>UPI</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodOption, formData.isBank && styles.methodOptionActive]}
                    onPress={() => handleMethodChange("Bank")}
                  >
                    <MaterialIcons
                      name="account-balance"
                      size={24}
                      color={formData.isBank ? COLORS.light : COLORS.primary}
                    />
                    <Text style={[styles.methodText, formData.isBank && styles.methodTextActive]}>Bank Transfer</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {formData.isUpi && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>UPI ID</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="smartphone" size={20} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="example@upi"
                      value={formData.upi_details.upi_id}
                      onChangeText={(value) => handleInputChange("upi_id", value)}
                    />
                  </View>
                  {errors.upi_id && <Text style={styles.errorText}>{errors.upi_id}</Text>}
                </View>
              )}

              {formData.isBank && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Bank Name</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="business" size={20} color={COLORS.gray} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter bank name"
                        value={formData.BankDetails.bankName}
                        onChangeText={(value) => handleInputChange("bankName", value)}
                      />
                    </View>
                    {errors.bankName && <Text style={styles.errorText}>{errors.bankName}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Account Number</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="account-box" size={20} color={COLORS.gray} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter account number"
                        keyboardType="numeric"
                        value={formData.BankDetails.accountNo}
                        onChangeText={(value) => handleInputChange("accountNo", value)}
                      />
                    </View>
                    {errors.accountNo && <Text style={styles.errorText}>{errors.accountNo}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>IFSC Code</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="code" size={20} color={COLORS.gray} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter IFSC code"
                        autoCapitalize="characters"
                        value={formData.BankDetails.ifsc_code}
                        onChangeText={(value) => handleInputChange("ifsc_code", value)}
                      />
                    </View>
                    {errors.ifsc_code && <Text style={styles.errorText}>{errors.ifsc_code}</Text>}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.light} />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                    <MaterialIcons name="send" size={18} color={COLORS.light} />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: SPACING.large,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.large,
  },
  headerTitle: {
    fontSize: SIZES.xxl,
    fontWeight: WEIGHTS.bold,
    color: COLORS.light,
  },
  balanceCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: RADIUS.large,
    padding: SPACING.large,
    marginTop: SPACING.medium,
  },
  balanceLabel: {
    fontSize: SIZES.medium,
    color: COLORS.light,
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: SIZES.title,
    fontWeight: WEIGHTS.bold,
    color: COLORS.light,
    marginVertical: SPACING.small,
  },
  withdrawButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.large,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: SPACING.small,
  },
  withdrawButtonText: {
    color: COLORS.light,
    fontWeight: WEIGHTS.medium,
    marginRight: SPACING.small,
  },
  content: {
    flex: 1,
    marginTop: -40,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.large,
  },
  section: {
    marginTop: SPACING.large,
    marginBottom: SPACING.xxxl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.large,
  },
  sectionTitle: {
    fontSize: SIZES.large,
    fontWeight: WEIGHTS.semiBold,
    color: COLORS.dark,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxxl,
  },
  loadingText: {
    marginTop: SPACING.medium,
    color: COLORS.gray,
    fontSize: SIZES.medium,
  },
  historyList: {
    marginBottom: SPACING.xxxl,
  },
  historyItem: {
    backgroundColor: COLORS.light,
    borderRadius: RADIUS.large,
    padding: SPACING.large,
    marginBottom: SPACING.large,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.medium,
  },
  historyItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyItemDetails: {
    marginLeft: SPACING.medium,
  },
  historyItemMethod: {
    fontSize: SIZES.medium,
    fontWeight: WEIGHTS.semiBold,
    color: COLORS.dark,
  },
  historyItemDate: {
    fontSize: SIZES.small,
    color: COLORS.gray,
  },
  statusBadge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.small,
    borderRadius: RADIUS.round,
  },
  successBadge: {
    backgroundColor: COLORS.success + "20",
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + "20",
  },
  rejectedBadge: {
    backgroundColor: COLORS.error + "20",
  },
  statusText: {
    fontSize: SIZES.xs,
    fontWeight: WEIGHTS.semiBold,
  },
  historyItemBody: {
    marginTop: SPACING.small,
  },
  amountText: {
    fontSize: SIZES.xl,
    fontWeight: WEIGHTS.bold,
    color: COLORS.dark,
    marginBottom: SPACING.small,
  },
  detailText: {
    fontSize: SIZES.small,
    color: COLORS.darkGray,
    marginBottom: SPACING.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxxl,
  },
  emptyStateText: {
    marginTop: SPACING.medium,
    color: COLORS.gray,
    fontSize: SIZES.medium,
    textAlign: "center",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.light,
    borderRadius: RADIUS.large,
    width: "90%",
    maxHeight: "80%",
    padding: SPACING.large,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.large,
  },
  modalTitle: {
    fontSize: SIZES.large,
    fontWeight: WEIGHTS.bold,
    color: COLORS.dark,
  },
  formContainer: {
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: SPACING.large,
  },
  label: {
    fontSize: SIZES.medium,
    fontWeight: WEIGHTS.medium,
    color: COLORS.dark,
    marginBottom: SPACING.small,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    backgroundColor: COLORS.light,
  },
  inputPrefix: {
    paddingHorizontal: SPACING.medium,
    fontSize: SIZES.large,
    color: COLORS.dark,
    fontWeight: WEIGHTS.semiBold,
  },
  inputIcon: {
    paddingLeft: SPACING.medium,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.medium,
    fontSize: SIZES.medium,
    color: COLORS.dark,
  },
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.small,
    marginTop: SPACING.xs,
  },
  methodSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  methodOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.medium,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.medium,
    marginRight: SPACING.small,
  },
  methodOptionActive: {
    backgroundColor: COLORS.primary,
  },
  methodText: {
    marginLeft: SPACING.small,
    color: COLORS.primary,
    fontWeight: WEIGHTS.medium,
  },
  methodTextActive: {
    color: COLORS.light,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.medium,
    paddingVertical: SPACING.medium,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.large,
    marginBottom: SPACING.xxxl,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.light,
    fontWeight: WEIGHTS.semiBold,
    fontSize: SIZES.medium,
    marginRight: SPACING.small,
  },
  serverError: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.medium,
    padding: SPACING.medium,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.large,
  },
  serverErrorText: {
    color: COLORS.light,
    marginLeft: SPACING.small,
    flex: 1,
  },
  // New styles for TDS calculation card
  calculationCard: {
    backgroundColor: "#F8F9FF",
    borderRadius: RADIUS.medium,
    padding: SPACING.large,
    marginBottom: SPACING.large,
    borderWidth: 1,
    borderColor: "#E6E8F0",
  },
  calculationTitle: {
    fontSize: SIZES.medium,
    fontWeight: WEIGHTS.semiBold,
    color: COLORS.dark,
    marginBottom: SPACING.medium,
  },
  calculationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.small,
  },
  calculationLabel: {
    fontSize: SIZES.small,
    color: COLORS.darkGray,
  },
  calculationValue: {
    fontSize: SIZES.small,
    fontWeight: WEIGHTS.medium,
    color: COLORS.dark,
  },
  calculationValueNegative: {
    fontSize: SIZES.small,
    fontWeight: WEIGHTS.medium,
    color: COLORS.error,
  },
  divider: {
    height: 1,
    backgroundColor: "#E6E8F0",
    marginVertical: SPACING.small,
  },
  calculationTotal: {
    fontSize: SIZES.medium,
    fontWeight: WEIGHTS.semiBold,
    color: COLORS.dark,
  },
  calculationTotalValue: {
    fontSize: SIZES.large,
    fontWeight: WEIGHTS.bold,
    color: COLORS.success,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(66, 133, 244, 0.08)",
    padding: SPACING.medium,
    borderRadius: RADIUS.small,
    marginTop: SPACING.medium,
  },
  infoText: {
    fontSize: SIZES.xs,
    color: COLORS.darkGray,
    marginLeft: SPACING.small,
    flex: 1,
    lineHeight: 16,
  },
})
