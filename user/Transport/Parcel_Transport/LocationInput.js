import React, { memo } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import Icon from "react-native-vector-icons/FontAwesome5";
import { styles } from './LocationInput.styles';

const SuggestionItem = memo(({ description, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.suggestionItem}
  >
    <Icon name="map-marker-alt" size={16} color="#6B7280" style={styles.suggestionIcon} />
    <Text numberOfLines={1} style={styles.suggestionText}>
      {description}
    </Text>
    <Icon name="chevron-right" size={14} color="#9CA3AF" style={styles.chevronIcon} />
  </TouchableOpacity>
));

export const LocationInput = ({
  icon,
  placeholder,
  value,
  onChangeText,
  suggestions = [],
  showSuggestions,
  onSelectLocation,
  inputRef,
}) => {
  const renderSuggestion = ({ item }) => (
    <SuggestionItem
      description={item.description}
      onPress={() => onSelectLocation(item.description)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Icon name={icon} size={20} color="#4B5563" style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor="#9CA3AF"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.clearButton}
          >
            <Icon name="times-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionList}>
            <Text style={styles.suggestionsHeader}>Suggestions</Text>
            {suggestions.map((item) => (
              <View key={item.place_id}>{renderSuggestion({ item })}</View>
            ))}
          </View>

        </View>
      )}
    </View>
  );
};