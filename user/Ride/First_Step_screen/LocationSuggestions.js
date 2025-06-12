import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import styles from "./Styles"

const LocationSuggestions = ({ state, pastRideSuggestions, onSelectLocation }) => {
  const renderPastRideSuggestions = () => {
    const suggestions = state.activeInput === "pickup" ? pastRideSuggestions.pickup : pastRideSuggestions.dropoff
    console.log("suggestions",suggestions.length)
    if (!suggestions || suggestions.length === 0) return null

    return (
      <View style={styles.pastRidesContainer}>
        <Text style={styles.pastRidesTitle}>
          {state.activeInput === "pickup" ? "🔄 Recent pickup locations" : "🔄 Recent drop-off locations"}
        </Text>

        {suggestions.map((item, index) => (
          <Pressable
            key={index}
            style={styles.pastRideItem}
            onPress={() => onSelectLocation(item.description, item.coordinates)}
            android_ripple={{ color: "#f0f0f0" }}
          >
            <Icon name="history" size={20} color={state.activeInput === "pickup" ? "#35C14F" : "#D93A2D"} />
            <Text numberOfLines={1} style={styles.pastRideText}>
              {item.description}
            </Text>
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollViewContent}
    >
      {/* Loading indicator for suggestions */}
      {state.loading && !state.suggestions.length && (
        <View style={styles.smallLoaderContainer}>
          <ActivityIndicator size="small" color={state.activeInput === "pickup" ? "#35C14F" : "#D93A2D"} />
          <Text style={styles.smallLoaderText}>Finding locations...</Text>
        </View>
      )}

      {/* Past ride suggestions */}
      {state.activeInput && !state.suggestions.length && renderPastRideSuggestions()}

      {/* Location suggestions */}
      {state.suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {state.suggestions.map((suggestion, index) => (
            <Pressable
              key={index}
              style={styles.suggestionItem}
              onPress={() => onSelectLocation(suggestion.description)}
              android_ripple={{ color: "#f0f0f0" }}
            >
              <Icon name="map-marker" size={20} color={state.activeInput === "pickup" ? "#35C14F" : "#D93A2D"} />
              <Text numberOfLines={2} style={styles.suggestionText}>
                {suggestion.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

export default LocationSuggestions
