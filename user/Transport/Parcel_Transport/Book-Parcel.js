import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import axios from "axios";
import Icon from "react-native-vector-icons/FontAwesome5";
import { tokenCache } from "../../Auth/cache";
import { useSocket } from "../../context/SocketContext";
import { useSocketInitialization } from "./useSocketInitialization";
import { LocationInput } from "./LocationInput";
import { ParcelDetails } from "./ParcelDetails";
import { styles } from "./parcel-booking.styles";
import { OtherInput } from "./OtherInputes";
import { useNavigation } from "@react-navigation/native";


const ParcelBooking = () => {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  const [etaData, setEtaData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [activeInput, setActiveInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [riderFound, setRiderFound] = useState(false);
  const navigation = useNavigation();
  const { socket } = useSocket();

  useSocketInitialization(socket(), () => {
    console.log('🟢 Socket initialization complete, setting up listeners');
    setupSocketListeners();
  });

  const setupSocketListeners = useCallback(() => {
    if (!socket()) return;

    console.log('🔵 Setting up socket listeners');
    socket().on("order_accepted_by_rider", (data) => {
      console.log("🟢 Order accepted by rider:", data);
      setLoading(false);
      setRiderFound(true);

    });

    return () => {
      console.log('🔵 Cleaning up () listeners');
      socket().off("order_accepted_by_rider");
    };
  }, [socket()]);

  const fetchSuggestions = useCallback(async (input) => {
    if (!input) {
      setSuggestions([]);
      return;
    }
    try {
      console.log('🔵 Fetching location suggestions');
      const { data } = await axios.get("https://api.srtutorsbureau.com/autocomplete", {
        params: { input },
      });
      console.log('🟢 Suggestions received');
      setSuggestions(data);
    } catch (err) {
      console.error('🔴 Error fetching suggestions:', err);
      setError("Failed to fetch location suggestions. Please try again.");
    }
  }, []);
  socket
  const handleLocationSelect = useCallback((location) => {
    console.log('🔵 Location selected:', activeInput);
    if (activeInput === "pickup") {
      setPickup(location);
    } else {
      setDropoff(location);
    }
    setSuggestions([]);
    setActiveInput(null);
  }, [activeInput]);

  const findDistanceAndEtaOFPriceAndTime = async () => {
    setError("");
    setLoading(true);
    try {
      console.log('🔵 Calculating distance and ETA');
      const { data } = await axios.post("http://192.168.1.6:3100/geo-code-distance", {
        pickup,
        dropOff: dropoff,
      });
      console.log('🟢 Distance and ETA calculated');
      setEtaData(data);
    } catch (error) {
      console.error('🔴 Error calculating distance:', error);
      setError("Failed to calculate distance and ETA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pickup && dropoff) {
      const delayDebounceFn = setTimeout(() => {
        findDistanceAndEtaOFPriceAndTime();
      }, 3000);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [pickup, dropoff]);

  const validateInputs = () => {
    console.log('🔵 Validating inputs');
    if (!pickup || !dropoff || !customerName || !customerPhone) {
      setError("Please fill in all fields");
      return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(customerName)) {
      setError("Please enter a valid name");
      return false;
    }
    if (!/^\d{10}$/.test(customerPhone)) {
      setError("Please enter a valid 10-digit phone number");
      return false;
    }
    console.log('🟢 Input validation passed');
    return true;
  };

  const handleBookNow = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    setError(""); // Clear any existing error

    try {
      console.log('🔵 Starting booking process');
      const token = await tokenCache.getToken("auth_token_db") || await tokenCache.getToken("auth_token");

      const { data } = await axios.post(
        "http://192.168.1.6:3100/api/v1/parcel/request_of_parcel",
        {
          pickup,
          dropoff,
         
          customerName,
          customerPhone,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('🟢 Booking request sent:', data);

      if (data.availableRiders.length === 0) {
        setError("No available riders");
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('🔴 Booking error:', error?.response?.data?.message || "Failed to book");
      setError(error?.response?.data?.message || "Failed to book");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (socket()) {
      const handleOrderAccepted = (data) => {
        console.log("🟢 Order accepted by rider:", data);
        setLoading(false);
        setRiderFound(true);
        navigation.navigate("Parcel");
      };

      socket().on("order_accepted_by_rider", handleOrderAccepted);

      return () => {
        socket().off("order_accepted_by_rider", handleOrderAccepted); // Cleanup
      };
    } else {
      // Alert.alert("No Free Riders Available", "Sorry, please try again later.", [
      //   { text: "OK", style: "default" },
      // ]);
      console.error("🔴 Socket is undefined");
    }
  }, [socket()]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Finding a rider for you...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Icon name="paper-plane" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Image
        source={{ uri: "https://i.ibb.co/R4sjSHKm/pngwing-com-20.png" }}
        style={styles.truckImage}
        resizeMode="contain"
      />

      <View style={styles.formCard}>
        <Text style={styles.title}>Deliver Your Food </Text>
        <Text style={styles.subtitle}>To Customer With Olyox</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <LocationInput
          icon="map-marker-alt"
          placeholder="Pickup location"
          value={pickup}
          onChangeText={(text) => {
            setPickup(text);
            setActiveInput("pickup");
            fetchSuggestions(text);
          }}
          suggestions={suggestions}
          showSuggestions={activeInput === "pickup"}
          onSelectLocation={handleLocationSelect}
        />

        <LocationInput
          icon="map-pin"
          placeholder="Drop location"
          value={dropoff}
          onChangeText={(text) => {
            setDropoff(text);
            setActiveInput("dropoff");
            fetchSuggestions(text);
          }}
          suggestions={suggestions}
          showSuggestions={activeInput === "dropoff"}
          onSelectLocation={handleLocationSelect}
        />

        {etaData && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaTitle}>Estimated Trip Details:</Text>
            <Text style={styles.etaText}>Distance: {etaData?.distance}</Text>
            <Text style={styles.etaText}>Duration: {etaData?.duration}</Text>
            <Text style={styles.etaText}>Price: {etaData?.price}</Text>
          </View>
        )}

        {/* <ParcelDetails
          weight={weight}
          setWeight={setWeight}
          length={length}
          setLength={setLength}
          width={width}
          setWidth={setWidth}
          height={height}
          setHeight={setHeight}
        /> */}

        <Text style={styles.sectionTitle}>Receiver Details</Text>

        <OtherInput
          icon="user"
          placeholder="Receiver name"
          value={customerName}
          onChangeText={(text) => setCustomerName(text)}
        />

        <OtherInput
          icon="phone"
          placeholder="Receiver Number"
          value={customerPhone}
          onChangeText={(text) => setCustomerPhone(text)}
        />

        <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Wrap the ParcelBooking component with ErrorBoundary
export default ParcelBooking

