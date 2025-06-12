import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Dimensions,
  Alert,
  Linking,
  BackHandler,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSocket } from '../../context/SocketContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { checkBhDetails } from '../../utils/Api';

const { width } = Dimensions.get('window');

// Modal components separated for better organization
const DocumentsModal = ({ visible, onClose, documents }) => (
  <Modal
    animationType="slide"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Documents</Text>
        <ScrollView>
          {documents && (
            <>
              <DocumentItem 
                icon="license" 
                title="Driver's License" 
                url={documents.license} 
              />
              <DocumentItem 
                icon="file-document" 
                title="Vehicle RC" 
                url={documents.rc} 
              />
              <DocumentItem 
                icon="account" 
                title="Profile Image" 
                url={documents.profile} 
              />
              <DocumentItem 
                icon="card-account-details" 
                title="Aadhar Front" 
                url={documents.aadharFront} 
              />
              <DocumentItem 
                icon="card-account-details-outline" 
                title="Aadhar Back" 
                url={documents.aadharBack} 
              />
              <DocumentItem 
                icon="shield-check" 
                title="Insurance" 
                url={documents.insurance} 
              />
            </>
          )}
        </ScrollView>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const DocumentItem = ({ icon, title, url }) => (
  <TouchableOpacity 
    onPress={() => Linking.openURL(url)} 
    style={styles.documentItem}
  >
    <MaterialCommunityIcons name={icon} size={24} color="#00BCD4" />
    <Text style={styles.documentText}>{title}</Text>
    <MaterialCommunityIcons name="chevron-right" size={24} color="#757575" />
  </TouchableOpacity>
);

const VehicleDetailsModal = ({ visible, onClose, vehicleInfo }) => (
  <Modal
    animationType="slide"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Vehicle Details</Text>
        <ScrollView>
          <DetailItem label="Vehicle Type" value={vehicleInfo?.vehicleType} />
          <DetailItem label="Vehicle Number" value={vehicleInfo?.VehicleNumber} />
          <DetailItem label="Model" value={vehicleInfo?.vehicleName} />
          <DetailItem label="RC Expires On" value={vehicleInfo?.RcExpireDate} />
        </ScrollView>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const ProfileDetailsModal = ({ visible, onClose, userData }) => (
  <Modal
    animationType="slide"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Profile Details</Text>
        <ScrollView>
          <DetailItem label="Name" value={userData?.name} />
          <DetailItem label="Phone" value={userData?.phone} />
          <DetailItem label="Recharge Plan" value={userData?.RechargeData?.rechargePlan} />
          <DetailItem 
            label="Expiry Date" 
            value={new Date(userData?.RechargeData?.expireData).toLocaleDateString('en-gb')} 
          />
        </ScrollView>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const DetailItem = ({ label, value }) => (
  <View style={styles.detailItem}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const StatItem = ({ value, label, onClick, extraLabel }) => (
  <TouchableOpacity 
    style={styles.statItem} 
    onPress={onClick}
    disabled={!onClick}
  >
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {extraLabel && <Text style={styles.statSubLabel}>{extraLabel}</Text>}
  </TouchableOpacity>
);

const MenuItem = ({ icon, title, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <MaterialCommunityIcons name={icon} size={24} color="#00BCD4" />
    <Text style={styles.menuText}>{title}</Text>
    <MaterialCommunityIcons name="chevron-right" size={24} color="#757575" />
  </TouchableOpacity>
);

export default function Profile() {
  const { socket } = useSocket();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [checkBhData, setBhData] = useState([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [showUpdateProfile, setShowUpdateProfile] = useState(false);

  // Fetch user details when component mounts
  useFocusEffect(
    useCallback(() => {
      fetchUserDetails();
      return () => {}; // Cleanup function
    }, [])
  );

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (token) {
        const response = await axios.get(
          'https://appapi.olyox.com/api/v1/rider/user-details',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.partner) {
          try {
            const data = await checkBhDetails(response.data.partner?.BH);
            if (data.complete) {
              setBhData([data.complete]);
            }
          } catch (error) {
            // Silent error handling
          }
        }
        setUserData(response.data.partner);
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalReferrals = useCallback(() => {
    if (!checkBhData.length) return 0;
    
    const index = checkBhData[0];
    return (
      (index.Child_referral_ids?.length || 0) +
      (index.Level1?.length || 0) +
      (index.Level2?.length || 0) +
      (index.Level3?.length || 0) +
      (index.Level4?.length || 0) +
      (index.Level5?.length || 0) +
      (index.Level6?.length || 0) +
      (index.Level7?.length || 0)
    );
  }, [checkBhData]);

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token_cab');

      // Disconnect the socket properly
      if (socket) {
        socket.disconnect();
      }
      
      // Reset navigation
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
      
      BackHandler.exitApp();
    } catch (error) {
      // Handle error silently
    }
  };

  const shareOurApp = () => {
    const msg = `🚀 *Join the Olyox Rides Family!* 🚖💨\n\nEarn *extra income* 💸 with *zero commission* 🆓 on every ride! 🛣️✨\n\nUse my *Referral Code*: 🔑 ${userData?.BH}\n\n📝 *Register now* and start earning in just a few minutes! ⏳💼\n\n👉(https://www.olyox.com/) 🌐`;

    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Error', 'WhatsApp is not installed on your device');
        } else {
          return Linking.openURL(url);
        }
      })
      .catch(() => Alert.alert('Error', 'An unexpected error occurred'));
  };



  const navigateToWithdraw = () => {
    if (checkBhData.length > 0) {
      navigation.navigate('withdraw', {
        _id: checkBhData[0]?._id,
        wallet: checkBhData[0]?.wallet
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {userData?.name ? userData.name[0].toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData?.name || 'Driver'}</Text>
            <Text style={styles.userPhone}>{userData?.phone || ''}</Text>
            <Text style={styles.userId}>BH ID: {userData?.BH || ''}</Text>
          </View>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <StatItem value={userData?.TotalRides || 0} label="Rides" />
        <View style={styles.statDivider} />
        
        <StatItem 
          value={calculateTotalReferrals() || 0} 
          label="Total Refer" 
        />
        <View style={styles.statDivider} />
        
        <StatItem 
          value={`₹${checkBhData[0]?.wallet || 0}`} 
          label="Refer Earning" 
          extraLabel="Make a Withdraw"
          onClick={navigateToWithdraw}
        />
        <View style={styles.statDivider} />
        
        <StatItem value={userData?.BH || 0} label="BH ID" />
      </View>

      {/* Menu Section */}
      <View style={styles.menuContainer}>
        <MenuItem 
          icon="file-document" 
          title="View Documents" 
          onPress={() => setShowDocuments(true)} 
        />
        
        <MenuItem 
          icon="account-edit" 
          title="Profile Details" 
          onPress={() => setShowUpdateProfile(true)} 
        />
        
        <MenuItem 
          icon="ticket-percent" 
          title="Unlock Deals For You" 
          onPress={() => navigation.navigate('UnlockCoupons')} 
        />
        
        <MenuItem 
          icon="car" 
          title="Vehicle Details" 
          onPress={() => setShowVehicleDetails(true)} 
        />
        
        <MenuItem 
          icon="gift" 
          title="Refer & Earn" 
          onPress={shareOurApp} 
        />
        
        <MenuItem 
          icon="account-group" 
          title="Referral History" 
          onPress={() => navigation.navigate('referral-history')} 
        />
        
        <MenuItem 
          icon="history" 
          title="Recharge History" 
          onPress={() => navigation.navigate('recharge-history')} 
        />
        
        <MenuItem 
          icon="qrcode" 
          title="Payment QR" 
          onPress={() => navigation.navigate('upload-qr')} 
        />
        
        <MenuItem 
          icon="logout" 
          title="Logout" 
          onPress={handleLogout} 
        />
      </View>

      {/* Modals */}
      <DocumentsModal 
        visible={showDocuments} 
        onClose={() => setShowDocuments(false)} 
        documents={userData?.documents} 
      />
      
      <VehicleDetailsModal 
        visible={showVehicleDetails} 
        onClose={() => setShowVehicleDetails(false)} 
        vehicleInfo={userData?.rideVehicleInfo} 
      />
      
      <ProfileDetailsModal 
        visible={showUpdateProfile} 
        onClose={() => setShowUpdateProfile(false)} 
        userData={userData} 
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#00BCD4',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00BCD4',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#616161',
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 10,
    color: '#00BCD4',
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#424242',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#00BCD4',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#424242',
  },
  detailItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#424242',
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#E0F7FA',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  closeButtonText: {
    color: '#00BCD4',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});