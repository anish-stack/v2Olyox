import React from 'react';
import { View, Text, Animated } from 'react-native';
import { styles } from './onboarding.styles';

export default function OnboardingSlide({ item, fontLoaded }) {
    
  return (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <Animated.Image
          source={{uri:item?.imageUrl?.image}}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, fontLoaded && { fontFamily: 'Roboto-Regular' }]}>
          {item.title}
        </Text>
        <Text style={[styles.description, fontLoaded && { fontFamily: 'Roboto-Regular' }]}>
          {item.description}
        </Text>
      </View>
    </View>
  );
}