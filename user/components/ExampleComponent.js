import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { decrement, increment } from '../redux/slice/exampleSlice';
import { COLORS } from '../constants/colors';


const ExampleComponent = () => {
  const count = useSelector((state) => state.example.value);
  const dispatch = useDispatch();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Count: {count}</Text>
      <View style={styles.buttonContainer}>
        <Button title="Increment" onPress={() => dispatch(increment())} color={COLORS.primary} />
        <Button title="Decrement" onPress={() => dispatch(decrement())} color={COLORS.secondary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    marginBottom: 10,
    color: COLORS.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
});

export default ExampleComponent;

