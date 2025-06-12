// components/EmptyCartMessage.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';

const EmptyCartMessage = () => {
  const navigation = useNavigation();

  const handleOrderNow = () => {
    navigation.navigate('Home'); // Change 'Menu' to your desired screen name
  };

  return (
    <View style={styles.container}>
      <LottieView
        source={require('./food.json')}
        autoPlay
        loop
        style={styles.lottie}
      />
      <Text style={styles.title}>Uh-oh! Your Cart is Hungry 😔</Text>
      <Text style={styles.subtitle}>
        Your belly called — it's asking for something delicious! 🥪🍕🍜{'\n'}
        Let’s fix that craving!
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleOrderNow}>
        <Text style={styles.buttonText}>Browse Menu & Order Now</Text>
      </TouchableOpacity>
    </View>
  );
};

export default EmptyCartMessage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lottie: {
    width: 280,
    height: 280,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginVertical: 14,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#E35335',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#EC5800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
