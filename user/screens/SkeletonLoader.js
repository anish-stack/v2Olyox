import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

const SkeletonLoader = ({ count = 6, height = 120, style }) => {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
       
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerValue]);

  const shimmerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [
      {
        translateX: shimmerValue.interpolate({
          inputRange: [0, 1],
          outputRange: [-100, width + 100],
        }),
      },
    ],
  };

  const renderSkeletonItems = () => {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push(
        <View key={i} style={[styles.skeletonBox, { height }]}>
          <Animated.View style={shimmerStyle} />
        </View>
      );
    }
    return items;
  };

  return (
    <View style={[styles.container, style]}>
      {renderSkeletonItems()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  skeletonBox: {
    height: 120,
    backgroundColor: COLORS.lightGrey,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
});

export default SkeletonLoader;
