import React, { useEffect, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';

const SkeletonLoader = () => {
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    // Create the shimmer effect animation
    Animated.loop(
      Animated.timing(animation, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [animation]);

  // Calculate the animated styles
  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-1, 1], // You can tweak this value for the shimmer speed
  });

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 10 }}>
      {Array(4).fill('').map((_, index) => (
        <View
          key={index}
          style={{
            width: 150,
            height: 120,
            marginBottom: 10,
            marginRight: 10,
            backgroundColor: '#e0e0e0',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              transform: [{ translateX }],
            }}
          />
        </View>
      ))}
    </View>
  );
};

export default SkeletonLoader;
