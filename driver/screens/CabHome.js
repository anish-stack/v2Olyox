import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  BackHandler,
  Alert,
  Image,
  Animated,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import * as Updates from "expo-updates";
import {
  MaterialCommunityIcons,
  FontAwesome5,
  Ionicons,
} from "@expo/vector-icons";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { useSocket } from "../context/SocketContext";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import RideCome from "./Ride.come";
import Report from "./Report/Report";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { initializeSocket } from "../context/socketService";
import { LocalRideStorage } from "../services/DatabaseService";
import styles from "./HomeScreen.styles";
import { useRideStatus } from "../context/CheckRideHaveOrNot.context";
import ActiveRideButton from "../ActiveRideButton";
import Bonus from "./Bonus/Bonus";

const CabHome = () => {
  try {
    const { isSocketReady, socket } = useSocket();
    const [menuVisible, setMenuVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [user_data, setUserData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [mapVisible, setMapVisible] = useState(true);
    const [activeRideData, setActiveRideData] = useState(null);
    const [showReconnectAnimation, setShowReconnectAnimation] = useState(false);
    const { onRide, updateRideStatus } = useRideStatus();
    const navigation = useNavigation();

    // Animation values
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const mapHeightAnim = useRef(new Animated.Value(200)).current;
    const refreshSpinValue = useRef(new Animated.Value(0)).current;

    // Get current location
    useEffect(() => {
      try {
        console.log("Initializing location tracking");
        (async () => {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setErrorMsg("Permission to access location was denied");
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          setLocation(location);

          // Set up location tracking
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 10, // update every 10 meters
              timeInterval: 5000, // update every 5 seconds
            },
            (newLocation) => {
              setLocation(newLocation);
            }
          );
        })();
      } catch (error) {
        console.error("Location tracking error:", error);
      }
    }, []);

    // Soft refresh function - maintains socket connection
    const onSoftRefresh = useCallback(async () => {
      try {
        console.log("Starting soft refresh");
        setRefreshing(true);

        // Start refresh animation
        Animated.loop(
          Animated.timing(refreshSpinValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        ).start();

        // Fetch user details without reloading the app
        await fetchUserDetails();

        // Pulse animation for status card
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        // Show success message
        Alert.alert("Refresh Complete", "Dashboard updated successfully");
      } catch (error) {
        console.error("Soft refresh failed:", error);
        Alert.alert("Refresh Failed", "Could not update dashboard information");
      } finally {
        setRefreshing(false);
        // Stop refresh animation
        refreshSpinValue.setValue(0);
      }
    }, []);

    // Hard refresh function - reloads the app
    const onHardRefresh = useCallback(async () => {
      try {
        console.log("Starting hard refresh");
        setRefreshing(true);
        await fetchUserDetails();
        await Updates.reloadAsync();

        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Home" }],
          })
        );
      } catch (error) {
        console.error("Hard refresh failed:", error);
        Alert.alert("Hard Refresh Failed", "Please try again later");
      } finally {
        setRefreshing(false);
      }
    }, [navigation]);

    const foundRideDetails = async () => {
      try {
        let temp_ride_id;

        if (
          user_data &&
          user_data.hasOwnProperty("on_ride_id") &&
          user_data.on_ride_id != null
        ) {
          temp_ride_id = user_data.on_ride_id;
          console.log("Fetching ride details for ride ID:", temp_ride_id);

          const response = await axios.get(
            `https://appapi.olyox.com/rider/${temp_ride_id}`
          );
          if (response.data) {
            console.log("response.data response.data", response.data)
            // Ensure we're passing a boolean to updateRideStatus
            updateRideStatus(true);
            setActiveRideData(response.data);
          }
        } else {
          // console.log("No active ride found or invalid on_ride_id");
          setActiveRideData(null);
        }
      } catch (error) {
        console.error(
          "Error fetching ride details:",
          error?.response?.data || error.message
        );
        setActiveRideData(null);
      }
    };

    useEffect(() => {
      try {
        if (user_data) {
          console.log("User data updated, checking for active rides");
          foundRideDetails();
        }
      } catch (error) {
        console.error("Error in foundRideDetails effect:", error);
      }
    }, [user_data]);

    const handleLogout = useCallback(
      async (retryCount = 0, maxRetries = 3) => {
        try {
          console.log("Attempting logout");
          // First, delete secure storage items regardless of connection state
          await SecureStore.deleteItemAsync("auth_token_cab");

          if (!user_data?._id) {
            console.log("No user ID available", user_data);
            // Even without ID, we should reset to Onboarding since tokens are deleted
            navigation.reset({
              index: 0,
              routes: [{ name: "Onboarding" }],
            });
            return;
          }

          // Attempt the logout API call
          const response = await axios.get(
            `https://appapi.olyox.com/api/v1/rider/rider-logout/${user_data._id}`
          );
          console.log("Logout successful:", response.data);

          // On success, reset navigation and exit
          navigation.reset({
            index: 0,
            routes: [{ name: "Onboarding" }],
          });

          BackHandler.exitApp();
        } catch (error) {
          console.error(`Logout Error (Attempt ${retryCount + 1}):`, error);

          // If we haven't reached max retries, try again after 4 seconds
          if (retryCount < maxRetries) {
            console.log(
              `Retrying logout in 4 seconds... (Attempt ${retryCount + 1
              }/${maxRetries})`
            );

            // Schedule retry after 4 seconds
            setTimeout(() => {
              handleLogout(retryCount + 1, maxRetries);
            }, 4000);
          } else {
            // If we've reached max retries, show only the specific server error message
            const errorMessage =
              error?.response?.data?.message &&
                error?.response?.data?.message !== "undefined"
                ? error.response.data.message
                : "Please try again. If you have an ongoing ride, please complete it first.";

            Alert.alert("Unable to Logout", errorMessage, [
              {
                text: "Try Again",
                onPress: () => handleLogout(0, maxRetries),
              },
              {
                text: "Force Logout",
                onPress: () => {
                  // Force navigation reset even if API call failed
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Onboarding" }],
                  });
                },
              },
            ]);
          }
        } finally {
          setMenuVisible(false);
        }
      },
      [navigation, user_data]
    );

    const handleHardReconnect = async (id) => {
      try {
        console.log("Attempting hard reconnect with ID:", id);
        if (!id) {
          return Alert.alert(
            "Connection Error",
            "Please try to re-login to reconnect"
          );
        }

        setShowReconnectAnimation(true);

        // Ensure the userId is correctly passed as a string
        const userId = id ? String(id) : "";
        console.log("Using userId for socket connection:", userId);

        const isReconnectingHard = await initializeSocket({
          userId: userId,
        });

        await onHardRefresh();
        // Simulate a delay to show the animation
        setTimeout(() => {
          setShowReconnectAnimation(false);

          if (isReconnectingHard === true) {
            Alert.alert(
              "Connection Successful",
              "You are now connected to the server"
            );
          }
        }, 2000);
      } catch (error) {
        console.error("Socket reconnection error:", error);
        setShowReconnectAnimation(false);
        Alert.alert(
          "Connection Failed",
          "Could not connect to the server. Please try again."
        );
      }
    };

    const hardClear = async () => {
      try {
        console.log("Performing hard clear");
        // Start rotation animation
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start(() => {
          rotateAnim.setValue(0);
        });

        await LocalRideStorage.clearRide();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Home" }],
          })
        );
      } catch (error) {
        console.error("Hard clear error:", error);
        Alert.alert("Error", "Failed to clear data. Please try again.");
      }
    };

    const fetchUserDetails = async () => {
      try {
        console.log("Fetching user details");
        setLoading(true);
        const token = await SecureStore.getItemAsync("auth_token_cab");
        if (token) {
          const response = await axios.get(
            "https://appapi.olyox.com/api/v1/rider/user-details",
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (response.data.partner) {
            console.log("User details fetched successfully");
            setUserData(response.data.partner);

            // Ensure we're setting a boolean value for isOnline
            const isAvailable = response.data.partner.isAvailable === true;
            setIsOnline(isAvailable);
            console.log(
              "Setting isOnline to:",
              isAvailable,
              "type:",
              typeof isAvailable
            );

            // Ensure proper type handling when initializing socket
            const userId = response?.data?.partner?._id
              ? String(response.data.partner._id)
              : "";
            console.log("Initializing socket with userId:", userId);

            await initializeSocket({
              userId: userId,
            });

            return response.data.partner;
          }
        }
      } catch (error) {
        console.error(
          "Error fetching user details:",
          error?.response?.data?.message || error.message
        );
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      try {
        console.log("Initial user details fetch");
        fetchUserDetails();
      } catch (error) {
        console.error("Error in initial fetchUserDetails:", error);
      }
    }, []);

    const toggleOnlineStatus = async () => {
      try {
        console.log("Toggling online status, current status:", isOnline);
        setLoading(true);

        const expireDate = new Date(user_data?.RechargeData?.expireData);
        const currentDate = new Date();

        // Ensure goingOnline is a boolean
        const goingOnline = isOnline === true ? false : true;
        console.log(
          "Setting status to:",
          goingOnline,
          "type:",
          typeof goingOnline
        );

        const token = await SecureStore.getItemAsync("auth_token_cab");

        if (goingOnline && expireDate < currentDate) {
          Alert.alert(
            "Recharge Expired",
            "You have been set to offline due to expired recharge.",
            [
              {
                text: "OK",
                onPress: () => navigation.navigate("Recharge", {
                  showOnlyBikePlan:
                    user_data?.rideVehicleInfo?.vehicleName ===
                      "2 Wheeler" ||
                      user_data?.rideVehicleInfo?.vehicleName === "Bike"
                      ? true
                      : false,
                  role: user_data?.category,
                  firstRecharge: user_data?.isFirstRechargeDone || false,
                }),

              },
            ]
          );
          setLoading(false);
          return;
        }

        // Always allow the API call if going OFFLINE regardless of recharge status
        const response = await axios.post(
          "https://appapi.olyox.com/api/v1/rider/toggleWorkStatusOfRider",
          { status: goingOnline }, // Make sure this is a boolean
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const response_two = await axios.get(
          "https://appapi.olyox.com/api/v1/rider/user-details",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const partnerData = response_two.data.partner;
        setUserData(partnerData);

        if (response.data.success) {
          // Ensure we're setting a boolean value
          const newStatus = response.data.cabRider?.status === "online";
          console.log("New status from API:", response.data.cabRider?.status);
          console.log(
            "Setting isOnline to:",
            newStatus,
            "type:",
            typeof newStatus
          );
          setIsOnline(newStatus);

          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 0.7,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (error) {
        console.error(
          "Toggle Status Error:",
          error?.response?.data?.message || error.message
        );
        Alert.alert(
          "Toggle Status Failed",
          error?.response?.data?.message || "Something went wrong",
          [{ text: "OK" }]
        );
      } finally {
        setLoading(false);
      }
    };

    const formatToIST = (dateString) => {
      try {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      } catch (error) {
        console.error("Date formatting error:", error);
        return "Invalid Date";
      }
    };

    const toggleMapVisibility = () => {
      try {
        console.log("Toggling map visibility, current state:", mapVisible);
        if (mapVisible) {
          // Collapse map
          Animated.timing(mapHeightAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }).start(() => setMapVisible(false));
        } else {
          // Expand map
          setMapVisible(true);
          Animated.timing(mapHeightAnim, {
            toValue: 200,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }
      } catch (error) {
        console.error("Map toggle error:", error);
      }
    };

    // Rotate interpolation for refresh icon
    const spin = refreshSpinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    // Rotate interpolation for hard refresh
    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });


    const Menu = useMemo(() => {
      try {
        console.log("Rendering Menu, visible:", menuVisible);
        return (
          <Modal
            animationType="slide"
            transparent={true}
            visible={menuVisible}
            onRequestClose={() => setMenuVisible(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setMenuVisible(false)}
            >
              <View style={styles.menuContainer}>
                <View style={styles.menuHandle} />

                <View style={styles.menuHeader}>
                  <Text style={styles.menuHeaderText}>Menu</Text>
                  <TouchableOpacity onPress={() => setMenuVisible(false)}>
                    <Ionicons name="close" size={24} color="#757575" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate("Profile");
                  }}
                >
                  <MaterialCommunityIcons
                    name="account"
                    size={24}
                    color="#00BCD4"
                  />
                  <Text style={styles.menuText}>Profile</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate("Recharge", {
                      showOnlyBikePlan:
                        user_data?.rideVehicleInfo?.vehicleName ===
                          "2 Wheeler" ||
                          user_data?.rideVehicleInfo?.vehicleName === "Bike"
                          ? true
                          : false,
                      role: user_data?.category,
                      firstRecharge: user_data?.isFirstRechargeDone || false,
                    });
                  }}
                >
                  <MaterialCommunityIcons
                    name="contactless-payment"
                    size={24}
                    color="#00BCD4"
                  />
                  <Text style={styles.menuText}>Recharge</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    onSoftRefresh();
                  }}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={24}
                    color="#00BCD4"
                  />
                  <Text style={styles.menuText}>Refresh Dashboard</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleLogout}
                >
                  <MaterialCommunityIcons
                    name="logout"
                    size={24}
                    color="#F44336"
                  />
                  <Text style={[styles.menuText, { color: "#F44336" }]}>
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        );
      } catch (error) {
        console.error("Menu render error:", error);
        return null;
      }
    }, [menuVisible, navigation, handleLogout, onSoftRefresh, user_data]);

    const StatusCard = useMemo(() => {
      try {


        // Ensure we're using boolean values
        const isAvailable = user_data?.isAvailable === true;
        const isConnected = socket?.connected === true;

        return (
          <Animated.View
            style={[styles.statusCard, { transform: [{ scale: scaleAnim }] }]}
          >
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View
                  style={[styles.statusIcon, { backgroundColor: "#E3F2FD" }]}
                >
                  <FontAwesome5 name="car" size={18} color="#2196F3" />
                </View>
                <Text style={styles.statusLabel}>Status</Text>
                <Text
                  style={[
                    styles.statusValue,
                    { color: isAvailable ? "#4CAF50" : "#F44336" },
                  ]}
                >
                  {isAvailable
                    ? "Online"
                    : user_data?.on_ride_id
                      ? "On Ride"
                      : "Offline"}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <View
                  style={[styles.statusIcon, { backgroundColor: "#E8F5E9" }]}
                >
                  <MaterialCommunityIcons
                    name="wifi"
                    size={18}
                    color="#4CAF50"
                  />
                </View>
                <Text style={styles.statusLabel}>Connection</Text>
                <Text
                  style={[
                    styles.statusValue,
                    { color: isConnected ? "#4CAF50" : "#F44336" },
                  ]}
                >
                  {isConnected ? "Connected" : "Offline"}
                </Text>
              </View>
            </View>
          </Animated.View>
        );
      } catch (error) {
        console.error("StatusCard render error:", error);
        return null;
      }
    }, [
      user_data?.isAvailable,
      user_data?.on_ride_id,
      socket?.connected,
      scaleAnim,
    ]);

    const DriverMap = useMemo(() => {
      try {
        if (!location) {
          console.log("No location data available for map");
          return null;
        }

        // console.log("Rendering DriverMap");
        return (
          <Animated.View
            style={[styles.mapContainer, { height: mapHeightAnim }]}
          >
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerCircle}>
                    <FontAwesome5 name="car" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.markerTriangle} />
                </View>
              </Marker>
            </MapView>
            <TouchableOpacity
              style={styles.mapToggleButton}
              onPress={toggleMapVisibility}
            >
              <MaterialCommunityIcons
                name={mapVisible ? "chevron-down" : "chevron-up"}
                size={24}
                color="#333"
              />
            </TouchableOpacity>
          </Animated.View>
        );
      } catch (error) {
        console.error("DriverMap render error:", error);
        return null;
      }
    }, [location, mapVisible, mapHeightAnim]);


    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#00BCD4" barStyle="light-content" />

        {/* Gradient Header */}
        <LinearGradient
          colors={["#00BCD4", "#0097A7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Driver Dashboard</Text>
            <View style={styles.headerActions}>
              {/* This is likely where the error is occurring */}
              {onRide === true && activeRideData ? (
                <TouchableOpacity>
                  <ActiveRideButton rideDetails={activeRideData} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={onSoftRefresh}
                style={styles.headerButton}
                disabled={refreshing === true}
              >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <MaterialCommunityIcons
                    name="refresh"
                    size={24}
                    color="#FFFFFF"
                  />
                </Animated.View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => hardClear()}
                style={styles.headerButton}
              >
                <Animated.View style={{ transform: [{ rotate: rotate }] }}>
                  <MaterialCommunityIcons
                    name="reload"
                    size={24}
                    color="#FFFFFF"
                  />
                </Animated.View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.headerButton}
              >
                <MaterialCommunityIcons name="menu" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onSoftRefresh}
              colors={["#00BCD4"]}
              tintColor="#00BCD4"
              progressBackgroundColor="#FFFFFF"
            />
          }
        >
          {/* {ConnectionStatus} */}
          <RideCome isRefresh={refreshing} />

          <View style={styles.content}>
            <View style={styles.welcomeCard}>
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  {user_data?.documents?.profile ? (
                    <Image
                      source={{ uri: user_data?.documents?.profile }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <MaterialCommunityIcons
                        name="account"
                        size={40}
                        color="#00BCD4"
                      />
                    </View>
                  )}
                </View>
                <View style={styles.welcomeTextContainer}>
                  <Text style={styles.welcomeText}>Welcome back!</Text>
                  <Text style={styles.nameText}>
                    {user_data?.name || "Driver"}
                  </Text>
                  <View style={styles.expiryContainer}>
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={14}
                      color="#757575"
                    />
                    <Text style={styles.subText}>
                      Expires:{" "}
                      {formatToIST(user_data?.RechargeData?.expireData)}
                    </Text>
                  </View>
                </View>
              </View>

              {StatusCard}

              <TouchableOpacity
                style={[
                  styles.onlineToggle,
                  {
                    backgroundColor:
                      loading === true
                        ? "#F5F5F5"
                        : isOnline === true
                          ? "#E8F5E9"
                          : user_data?.on_ride_id
                            ? "#FFF3E0" // light orange for "Ride In Progress"
                            : "#FFEBEE",
                  },
                ]}
                onPress={toggleOnlineStatus}
                disabled={
                  loading === true || user_data?.on_ride_id ? true : false
                }
              >
                <MaterialCommunityIcons
                  name={
                    loading === true
                      ? "progress-clock"
                      : isOnline === true
                        ? "car"
                        : user_data?.on_ride_id
                          ? "steering" // or "car-wrench" or "clock"
                          : "car-off"
                  }
                  size={24}
                  color={
                    loading === true
                      ? "#757575"
                      : isOnline === true
                        ? "#4CAF50"
                        : user_data?.on_ride_id
                          ? "#FB8C00" // orange
                          : "#F44336"
                  }
                />
                <Text
                  style={[
                    styles.onlineToggleText,
                    {
                      color:
                        loading === true
                          ? "#757575"
                          : isOnline === true
                            ? "#4CAF50"
                            : user_data?.on_ride_id
                              ? "#FB8C00"
                              : "#F44336",
                    },
                  ]}
                >
                  {loading === true
                    ? "Updating..."
                    : isOnline === true
                      ? "Go Offline"
                      : user_data?.on_ride_id
                        ? "Ride In Progress"
                        : "Go Online"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.reconnectButton,
                  {
                    backgroundColor:
                      isSocketReady === true ? "#E0F7FA" : "#FFEBEE",
                  },
                ]}
                onPress={() => handleHardReconnect(user_data?._id)}
                disabled={loading === true || showReconnectAnimation === true}
              >
                {showReconnectAnimation === true ? (
                  <View style={styles.reconnectingContainer}>
                    <ActivityIndicator size="small" color="#00BCD4" />
                    <Text style={[styles.reconnectText, { color: "#00BCD4" }]}>
                      Reconnecting...
                    </Text>
                  </View>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={isSocketReady === true ? "wifi-check" : "wifi-off"}
                      size={24}
                      color={isSocketReady === true ? "#00BCD4" : "#F44336"}
                    />
                    <Text
                      style={[
                        styles.reconnectText,
                        {
                          color: isSocketReady === true ? "#00BCD4" : "#F44336",
                        },
                      ]}
                    >
                      {isSocketReady === true
                        ? "Connected to Server"
                        : "Reconnect to Server"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {/* Tips */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>Tips while waiting</Text>
              <View style={styles.tipsList}>
                <View style={styles.tipItem}>
                  <MaterialCommunityIcons name="battery" size={16} color="#10b981" />
                  <Text style={styles.tipText}>Keep your phone charged</Text>
                </View>
                <View style={styles.tipItem}>
                  <MaterialCommunityIcons name="volume-high" size={16} color="#10b981" />
                  <Text style={styles.tipText}>Turn up your volume</Text>
                </View>
                <View style={styles.tipItem}>
                  <MaterialCommunityIcons name="signal" size={16} color="#10b981" />
                  <Text style={styles.tipText}>Stay in good network areas</Text>
                </View>
              </View>
            </View>
            {!mapVisible && (
              <TouchableOpacity
                style={styles.showMapButton}
                onPress={toggleMapVisibility}
              >
                <MaterialCommunityIcons
                  name="map-marker"
                  size={20}
                  color="#00BCD4"
                />
                <Text style={styles.showMapText}>Show My Location</Text>
              </TouchableOpacity>
            )}

            {/* {mapVisible && DriverMap} */}
            <Report isRefresh={refreshing} />

            <Bonus />
          </View>
        </ScrollView>

        {Menu}
      </SafeAreaView>
    );
  } catch (error) {
    console.error("Fatal error in CabHome component:", error);
    // Fallback UI in case of critical error
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 10,
            color: "#F44336",
          }}
        >
          Something went wrong
        </Text>
        <Text style={{ textAlign: "center", marginBottom: 20 }}>
          {error.message ||
            "An unexpected error occurred. Please restart the app."}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: "#00BCD4",
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 8,
          }}
          onPress={() => Updates.reloadAsync()}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>
            Restart App
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
};

export default React.memo(CabHome);
