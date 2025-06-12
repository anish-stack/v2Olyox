import { View, StyleSheet } from "react-native"
import Input from "../../../components/Input"

const BasicDetails = ({ formData, onInputChange }) => (
  <View style={styles.container}>
    <Input
      placeholder="Full Name"
      value={formData.name}
      onChangeText={(text) => onInputChange("name", text)}
      icon="account"
    />
    <Input
      placeholder="Email"
      value={formData.email}
      onChangeText={(text) => onInputChange("email", text)}
      keyboardType="email-address"
      icon="email"
    />
    <Input
      placeholder="Phone"
      value={formData.phone}
      onChangeText={(text) => onInputChange("phone", text)}
      keyboardType="phone-pad"
      icon="phone"
    />
    <Input
      placeholder="Address"
      value={formData.address}
      onChangeText={(text) => onInputChange("address", text)}
      multiline
      icon="map-marker"
    />
  </View>
)

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
})

export default BasicDetails

