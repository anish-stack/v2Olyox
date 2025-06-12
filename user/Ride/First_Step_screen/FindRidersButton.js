import { View, Text, TouchableOpacity } from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import styles from "./Styles"

const FindRidersButton = ({ onPress }) => {
  return (
    <View style={styles.findRiderButtonContainer}>
      <TouchableOpacity style={styles.findRiderButton} onPress={onPress} activeOpacity={0.8}>
        <Icon name="car" size={24} color="white" />
        <Text style={styles.findRiderButtonText}>Find Riders</Text>
      </TouchableOpacity>
    </View>
  )
}

export default FindRidersButton
