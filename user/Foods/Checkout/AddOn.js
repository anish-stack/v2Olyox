import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native"
import { useState, useCallback, useEffect } from "react"
import { useFood } from "../../context/Food_Context/Food_context"
import axios from "axios"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"

export default function AddOn({ restaurant_id }) {
  console.log("v", restaurant_id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [imageError,setImageError] = useState(false)
  const [details, setDetails] = useState(null)
  const [foods, setFoods] = useState([])
  const { addFood, cart, updateQuantity } = useFood()

  // Get items not in cart
  const addOnItems = foods.filter((food) => !cart.some((cartItem) => cartItem._id === food._id))

  const getItemQuantity = useCallback(
    (itemId) => {
      const cartItem = cart.find((item) => item._id === itemId)
      return cartItem ? cartItem.quantity : 0
    },
    [cart],
  )

  const handleAddOrUpdate = useCallback(
    (item) => {
      const quantity = getItemQuantity(item._id)
      if (quantity === 0) {
        addFood({ ...item, quantity: 1 })
      } else {
        updateQuantity(item._id, quantity + 1)
      }
    },
    [addFood, updateQuantity, getItemQuantity],
  )

  const fetchFoods = useCallback(async () => {
    // console.log("restaurant_ haveid",restaurant_id)
    setLoading(true)
    try {
      const { data } = await axios.get(
        `http://192.168.1.6:3100/api/v1/tiffin/find_Restaurant_And_Her_foods?restaurant_id=${restaurant_id?._id}`,
      )
      if (data.details) {
        setDetails(data.details)
        setFoods(data.food)
      }
    } catch (error) {
      setFoods([])
      console.log("erro", error.response.data)

      // setError("Unable to fetch add-ons. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [restaurant_id])

  useEffect(() => {
    fetchFoods()
  }, [fetchFoods])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4D67" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={24} color="#FF4D67" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  if (addOnItems.length === 0) {
    return null
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Icon name="silverware-fork-knife" size={20} color="#1C1C1C" />
        <Text style={styles.title}>Complete your meal with</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {addOnItems.map((item, index) => (
          <View
            key={item._id}
            style={[
              styles.addOnCard,
              index === 0 && styles.firstCard,
              index === addOnItems.length - 1 && styles.lastCard,
            ]}
          >

            <Image source={imageError ? (require('./no-image.jpeg')) : { uri: item.images.url }}
             onError={()=>setImageError(true)}
             style={styles.image} />
            <View style={styles.infoContainer}>
              <Text style={styles.foodName} numberOfLines={2}>
                {item.food_name}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{item?.food_price.toFixed(2)}</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => handleAddOrUpdate(item)}>
                  <Text style={styles.addButtonText}>ADD +</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1C",
    marginLeft: 8,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  addOnCard: {
    width: 160,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  firstCard: {
    marginLeft: 12,
  },
  lastCard: {
    marginRight: 12,
  },
  image: {
    width: "100%",
    height: 140,
    resizeMode: "cover",
    borderRadius: 8,
  },
  infoContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  foodName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1C1C1C",
    marginBottom: 8,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1C",
  },
  addButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FF4D67",
  },
  addButtonText: {
    color: "#FF4D67",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF2F4",
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    marginLeft: 8,
    color: "#FF4D67",
    flex: 1,
  },
})

