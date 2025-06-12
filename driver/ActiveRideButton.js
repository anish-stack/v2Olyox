

import { useEffect } from "react"
import { TouchableOpacity, StyleSheet, View, Animated } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"

const ActiveRideButton = ({ rideDetails }) => {
  const navigation = useNavigation()
  const pulseAnim = new Animated.Value(1)

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }, [])

  const handlePress = () => {
    navigation.navigate("start", { params: rideDetails })
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <Animated.View style={[styles.button, { transform: [{ scale: pulseAnim }] }]}>
        <MaterialCommunityIcons name="car" size={20} color="#fff" />
        <View style={styles.dot} />
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // container: {
  //   position: "absolute",
  //   bottom: 0,
  //   right: 20,
  //   zIndex: 1000,
  // },
  button: {
    backgroundColor: "#FF3B30",
    borderRadius: 30,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    backgroundColor: "#4CAF50",
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
})

export default ActiveRideButton

