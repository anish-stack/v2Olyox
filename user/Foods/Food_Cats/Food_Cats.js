import React, { 
  useRef, 
  useEffect, 
  useCallback, 
  useMemo, 
  memo 
} from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Animated,
  Dimensions,
  Platform
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// Performance tracking
const performanceTracker = {
  renderCount: 0,
  
  trackRender: (componentName) => {
    performanceTracker.renderCount++;
    console.count(`🍽️ ${componentName} render count`);
  }
};

// Memoized Food Category Item Component
const FoodCategoryItem = memo(({ item, index, onPress, slideAnim }) => {
  performanceTracker.trackRender('FoodCategoryItem');
  
  // Memoized icon mapping
  const iconConfig = useMemo(() => {
    const iconMap = {
      "Tiffins": {
        component: MaterialIcons,
        name: "breakfast-dining",
        color: "#FF6B35"
      },
      "Veg": {
        component: MaterialCommunityIcons,
        name: "leaf",
        color: "#4CAF50"
      },
      "Non Veg": {
        component: Ionicons,
        name: "restaurant",
        color: "#F44336"
      }
    };
    return iconMap[item.title] || iconMap["Tiffins"];
  }, [item.title]);

  // Memoized container style
  const containerStyle = useMemo(() => [
    styles.itemContainer,
    { transform: [{ translateX: slideAnim }] }
  ], [slideAnim]);

  // Memoized icon container style
  const iconContainerStyle = useMemo(() => [
    styles.imageContainer,
    { backgroundColor: iconConfig.color + '15' }
  ], [iconConfig.color]);

  const handlePress = useCallback(() => {
    console.log(`🎯 Food category pressed: ${item.title}`);
    onPress(index, item.title);
  }, [index, item.title, onPress]);

  const IconComponent = iconConfig.component;

  return (
    <Animated.View style={containerStyle}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        style={styles.touchable} 
        onPress={handlePress}
      >
        <View style={iconContainerStyle}>
          <IconComponent
            name={iconConfig.name}
            size={isTablet ? 36 : 30}
            color={iconConfig.color}
          />
        </View>
        <Text style={styles.title}>{item.title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

FoodCategoryItem.displayName = 'FoodCategoryItem';

const Food_Cats = () => {
  console.time('🍽️ Food_Cats Mount Time');
  
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const navigation = useNavigation();
  const mountTime = useRef(Date.now());
  
  performanceTracker.trackRender('Food_Cats');

  // Memoized food categories data
  const foodsCategories = useMemo(() => [
    {
      id: 1,
      title: "Tiffins",
    },
    {
      id: 4,
      title: "Veg",
    },
    {
      id: 5,
      title: "Non Veg",
    }
  ], []);

  // Memoized animation effect
  useEffect(() => {
    console.time('🎬 Slide Animation Time');
    
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      console.timeEnd('🎬 Slide Animation Time');
      console.log('✅ Slide animation completed');
    });

    return () => {
      const totalTime = Date.now() - mountTime.current;
      console.log(`🍽️ Food_Cats total lifecycle: ${totalTime}ms`);
    };
  }, [slideAnim]);

  // Optimized press animation with performance tracking
  const animatePress = useCallback((index, title) => {
    console.time('🎬 Press Animation Time');
    console.log(`🎯 Animating press for: ${title} at index: ${index}`);
    
    Animated.sequence([
      Animated.timing(slideAnim, { 
        toValue: 5, 
        duration: 100, 
        useNativeDriver: true 
      }),
      Animated.timing(slideAnim, { 
        toValue: -5, 
        duration: 100, 
        useNativeDriver: true 
      }),
      Animated.timing(slideAnim, { 
        toValue: 0, 
        duration: 100, 
        useNativeDriver: true 
      }),
    ]).start(() => {
      console.timeEnd('🎬 Press Animation Time');
      console.log('✅ Press animation completed');
    });

    setTimeout(() => {
      console.log(`🧭 Navigating to: ${title}`);
      
      if (title === "Tiffins") {
        navigation.navigate("Tiffins_Page");
      } else {
        navigation.navigate('food_Page_By_Cats', { title: title });
      }
    }, 400);
  }, [slideAnim, navigation]);

  // Memoized render item function
  const renderItem = useCallback(({ item, index }) => (
    <FoodCategoryItem
      item={item}
      index={index}
      onPress={animatePress}
      slideAnim={slideAnim}
    />
  ), [animatePress, slideAnim]);

  // Memoized key extractor
  const keyExtractor = useCallback((item) => item.id.toString(), []);

  // Memoized FlatList props
  const flatListProps = useMemo(() => ({
    data: foodsCategories,
    renderItem: renderItem,
    keyExtractor: keyExtractor,
    horizontal: true,
    showsHorizontalScrollIndicator: false,
    contentContainerStyle: styles.flatListContent,
    initialNumToRender: 3,
    maxToRenderPerBatch: 3,
    windowSize: 5,
    removeClippedSubviews: Platform.OS === 'android',
    getItemLayout: (data, index) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
  }), [foodsCategories, renderItem, keyExtractor]);

  console.timeEnd('🍽️ Food_Cats Mount Time');
  console.log(`📱 Screen width: ${screenWidth}px`);
  console.log(`📱 Device type: ${isTablet ? 'Tablet' : 'Phone'}`);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Culinary Delights</Text>
      <Text style={styles.subHeader}>What's your craving today?</Text>
      <LinearGradient
        colors={["#FFE5E5", "#FFF0F0", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <FlatList {...flatListProps} />
      </LinearGradient>
    </View>
  );
};

// Constants for performance optimization
const ITEM_WIDTH = isTablet ? 130 : 110;

const styles = StyleSheet.create({
  container: {
    padding: isTablet ? 16 : 10,
    backgroundColor: "#FFFFFF",
  },
  header: {
    fontSize: isTablet ? 28 : 24,
    fontWeight: "800",
    color: "#CB202D",
    marginBottom: 5,
    fontFamily: Platform.OS === 'ios' ? "System" : "Roboto",
    letterSpacing: 0.5,
  },
  subHeader: {
    fontSize: isTablet ? 18 : 16,
    color: "#666",
    marginBottom: isTablet ? 24 : 20,
    fontFamily: Platform.OS === 'ios' ? "System" : "Roboto",
    fontStyle: "italic",
  },
  gradient: {
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  flatListContent: {
    paddingRight: 14,
    paddingLeft: 2,
  },
  itemContainer: {
    marginRight: isTablet ? 40 : 0,
    alignItems: "center",
    width: ITEM_WIDTH,
  },
  touchable: {
    alignItems: "center",
    padding: 5,
  },
  imageContainer: {
    width: isTablet ? 80 : 60,
    height: isTablet ? 80 : 60,
    borderRadius: isTablet ? 40 : 30,
    backgroundColor: "#FFFFFF",
 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: "#FFE5E5",
  },
  title: {
    marginTop: isTablet ? 12 : 10,
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    fontFamily: Platform.OS === 'ios' ? "System" : "Roboto",
  },
});

export default memo(Food_Cats);