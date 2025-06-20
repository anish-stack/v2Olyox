import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  SafeAreaView,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function Recharge() {
  const route= useRoute()
  const {showOnlyBikePlan} = route.params || {}
  const navigation = useNavigation();
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [timer, setTimer] = useState(30 * 60);

  console.log(showOnlyBikePlan)

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (token) {
        const response = await axios.get('http://192.168.1.6:3100/api/v1/rider/user-details', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserData(response.data.partner);
      }
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
    fetchMembershipPlan();
  }, []);

  useEffect(() => {
    let interval;
    if (showQR && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showQR, timer]);

  const fetchMembershipPlan = async () => {
    try {
      const { data } = await axios.get('https://www.api.olyox.com/api/v1/membership-plans');
      setMemberships(data.data);
    } catch (err) {
      Alert.alert('Error', 'Error fetching membership plans');
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePlanSelect = (memberId) => {
    setSelectedMemberId(memberId);
    setShowQR(true);
  };

  const handleCancelPayment = () => {
    setShowQR(false);
    setTransactionId('');
    setTimer(30 * 60);
  };

  const handleRecharge = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      const { data } = await axios.post(
        `https://www.webapi.olyox.com/api/v1/do-recharge?_id=${userData?.BH}`,
        {
          userId: userData?._id,
          plan_id: selectedMemberId,
          trn_no: transactionId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Alert.alert('Success', data?.message);
      setLoading(false);
      navigation.goBack();
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', error?.response?.data?.message || error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF385C" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!showQR ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose Your Plan</Text>
            <Text style={styles.headerSubtitle}>Select a membership plan that suits your needs</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.planContainer}
            showsVerticalScrollIndicator={false}
          >
            {memberships.map((plan) => (
              <TouchableOpacity
                key={plan._id}
                style={[
                  styles.planCard,
                  plan._id === selectedMemberId && styles.selectedPlan,
                ]}
                onPress={() => handlePlanSelect(plan._id)}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <MaterialCommunityIcons
                    name={plan._id === selectedMemberId ? "check-circle" : "circle-outline"}
                    size={24}
                    color={plan._id === selectedMemberId ? "#FF385C" : "#666"}
                  />
                </View>
                <Text style={styles.planPrice}>₹{plan.price}</Text>
                <Text style={styles.gstText}>+18% GST</Text>
                <View style={styles.divider} />
                <Text style={styles.planDescription}>{plan.description}</Text>
                <View style={styles.validityContainer}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                  <Text style={styles.planValidity}>
                    Valid for {plan.validityDays} {plan.whatIsThis}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : (
        <View style={styles.qrContainer}>

          <View style={styles.timerContainer}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#FF385C" />
            <Text style={styles.timerText}>{formatTime(timer)}</Text>
          </View>
          <View style={styles.qrCard}>
            <Image
              source={{ uri: 'https://offercdn.paytm.com/blog/2022/02/scan/scan-banner.png' }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.verificationContainer}>
            <Text style={styles.verificationTitle}>Payment Verification</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter transaction ID"
              value={transactionId}
              onChangeText={setTransactionId}
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={[styles.verifyButton, !transactionId && styles.disabledButton]}
              onPress={handleRecharge}
              disabled={!transactionId || loading}
            >
              <Text style={styles.verifyButtonText}>
                {loading ? 'Verifying...' : 'Verify Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  planContainer: {
    padding: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
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
  selectedPlan: {
    borderWidth: 2,
    borderColor: '#FF385C',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF385C',
  },
  gstText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  planDescription: {
    fontSize: 16,
    color: '#444',
    lineHeight: 22,
    marginBottom: 16,
  },
  validityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planValidity: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  qrContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff4f6',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF385C',
    marginLeft: 8,
  },
  qrCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrImage: {
    width: width - 120,
    height: width - 120,
    borderRadius: 12,
  },
  verificationContainer: {
    padding: 20,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#000',
  },
  verifyButton: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ffd1d8',
  },
});