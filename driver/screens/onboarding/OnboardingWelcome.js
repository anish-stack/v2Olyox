import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"

const { width } = Dimensions.get("window")

const OnboardingWelcome = ({ onRegister, onLogin, onComplete }) => (
  <View style={styles.container}>
    <Image
      source={{
        uri: "https://i.ibb.co/Txdpj8Qj/image-of.png",
      }}
      style={styles.image}
      resizeMode="contain"
    />
    <Text style={styles.title}>Welcome to Olyox Rider App</Text>
    <Text style={styles.subtitle}>Start your journey as a delivery partner</Text>
    <TouchableOpacity style={styles.button} onPress={onRegister}>
      <Icon name="account-plus" size={24} color="#fff" style={styles.icon} />
      <Text style={styles.buttonText}>New Register</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={onLogin}>
      <Icon name="login" size={24} color="#e51e25" style={styles.icon} />
      <Text style={[styles.buttonText, styles.loginButtonText]}>Login</Text>
    </TouchableOpacity>
    {/* <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={onComplete}>
      <Icon name="login" size={24} color="#e51e25" style={styles.icon} />
      <Text style={[styles.buttonText, styles.loginButtonText]}>Complete Profile</Text>
    </TouchableOpacity> */}
  </View>
)

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  image: {
    width: width * 0.9,
    height: width * 0.9,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#191503",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffd423",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 15,
    minWidth: width * 0.6,
  },
  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ffeea7",
  },
  loginButtonText: {
    color: "#191503",
  },
  icon: {
    marginRight: 10,
  },
})

export default OnboardingWelcome

