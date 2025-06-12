
import { useRef } from "react"
import { View, TextInput, TouchableOpacity, Animated, ActivityIndicator, Keyboard } from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import styles from "./Styles"

const LocationInputs = ({ state, setState, isFetchingLocation, onMapSelect, onLocationSelect }) => {
  const pickupInputRef = useRef(null)
  const dropoffInputRef = useRef(null)
  const loadingAnimation = useRef(new Animated.Value(0)).current
  const debounceTimer = useRef(null)

  const fetchSuggestions = (input, type) => {
    if (!input || input.length < 2) {
      setState((prev) => ({ ...prev, suggestions: [] }))
      return
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    setState((prev) => ({ ...prev, loading: true }))

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`https://api.srtutorsbureau.com/autocomplete?input=${encodeURIComponent(input)}`)
        const data = await response.json()

        setState((prev) => ({
          ...prev,
          suggestions: data || [],
          loading: false,
          activeInput: type,
        }))
      } catch (error) {
        console.error("Suggestion error:", error)
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to fetch suggestions",
        }))
      }
    }, 300)
  }

  const handleTextChange = (text, type) => {
    if (type === "pickup") {
      setState((prev) => ({ ...prev, pickup: text }))
    } else {
      setState((prev) => ({ ...prev, dropoff: text }))
    }
    fetchSuggestions(text, type)
  }

  const handleInputBlur = (type) => {
    // Small delay to allow suggestion selection
    setTimeout(() => {
      if (state.activeInput === type) {
        setState((prev) => ({
          ...prev,
          activeInput: null,
          suggestions: []
        }))
      }
    }, 150)
  }

  const handleMapSelect = (type) => {
    // Dismiss keyboard and blur the input
    if (type === "pickup" && pickupInputRef.current) {
      pickupInputRef.current.blur()
    } else if (type === "dropoff" && dropoffInputRef.current) {
      dropoffInputRef.current.blur()
    }

    Keyboard.dismiss()

    // Clear suggestions and active input
    setState((prev) => ({
      ...prev,
      suggestions: [],
      activeInput: null
    }))

    // Call parent handler
    onMapSelect(type)
  }

  return (
    <View style={styles.inputsContainer}>
      {/* Pickup Input */}
      <View style={styles.inputWrapper}>
        <View style={styles.inputIconContainer}>
          <Icon name="circle" size={12} color="#35C14F" />
        </View>

        <TextInput
          ref={pickupInputRef}
          style={styles.input}
          placeholder="Enter pickup location"
          placeholderTextColor="#999"
          value={state.pickup}
          onChangeText={(text) => handleTextChange(text, "pickup")}
          onFocus={() => {
            setState((prev) => ({ ...prev, activeInput: "pickup" }))
          }}
          onBlur={() => handleInputBlur("pickup")}
          onSubmitEditing={() => {
            // Dismiss keyboard on submit
            Keyboard.dismiss()
            pickupInputRef.current?.blur()
          }}
          returnKeyType="done"
          blurOnSubmit={true}
          multiline={true} // Changed to false for better keyboard handling
        />

        {isFetchingLocation && state.activeInput === "pickup" ? (
          <Animated.View
            style={{
              opacity: loadingAnimation,
              transform: [
                {
                  scale: loadingAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            }}
          >
            <ActivityIndicator size="small" color="#35C14F" />
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => handleMapSelect("pickup")}
            activeOpacity={0.7}
          >
            <Icon name="map-marker" size={24} color="#35C14F" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropoff Input */}
      <View style={styles.inputWrapper}>
        <View style={styles.inputIconContainer}>
          <Icon name="square" size={12} color="#D93A2D" />
        </View>

        <TextInput
          ref={dropoffInputRef}
          style={styles.input}
          placeholder="Enter drop-off location"
          placeholderTextColor="#999"
          value={state.dropoff}
          onChangeText={(text) => handleTextChange(text, "dropoff")}
          onFocus={() => {
            setState((prev) => ({ ...prev, activeInput: "dropoff" }))
          }}
          onBlur={() => handleInputBlur("dropoff")}
          onSubmitEditing={() => {
            // Dismiss keyboard on submit
            Keyboard.dismiss()
            dropoffInputRef.current?.blur()
          }}
          returnKeyType="done"
          blurOnSubmit={true}
          multiline={true} // Changed to false for better keyboard handling
        />

        {state.loading && state.activeInput === "dropoff" ? (
          <Animated.View
            style={{
              opacity: loadingAnimation,
              transform: [
                {
                  scale: loadingAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            }}
          >
            <ActivityIndicator size="small" color="#D93A2D" />
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => handleMapSelect("dropoff")}
            activeOpacity={0.7}
          >
            <Icon name="map-marker" size={24} color="#D93A2D" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default LocationInputs