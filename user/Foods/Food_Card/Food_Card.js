import { useNavigation } from "@react-navigation/native"
import React, { useState, useCallback } from "react"
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Vibration } from "react-native"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import { useFood } from "../../context/Food_Context/Food_context"

const Food_Card = ({ item, isAddAble = false }) => {

    const { cart, addFood, updateQuantity } = useFood()
    const [scaleValue] = useState(new Animated.Value(1))
    const navigation = useNavigation()
    // console.log(item?.restaurant_id?.restaurant_name)
    // Check if item is in cart and get its quantity
    const cartItem = cart?.find((cartItem) => cartItem._id === item._id)
    const quantity = cartItem?.quantity || 0

    const handlePressIn = () => {
        Animated.spring(scaleValue, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start()
        Vibration.vibrate(210)
    }

    const handlePressOut = () => {
        Animated.spring(scaleValue, {
            toValue: 1,
            useNativeDriver: true,
        }).start()

    }

    const handleAddOrUpdate = useCallback(() => {
        if (quantity === 0) {
            addFood(item)

        } else {
            updateQuantity(item._id, quantity + 1)
        }
    }, [item, quantity, addFood, updateQuantity])

    const handleDecrement = useCallback(() => {
        if (quantity > 0) {
            updateQuantity(item._id, quantity - 1)
        }
    }, [item._id, quantity, updateQuantity])

    const renderAddButton = () => {
        if (quantity === 0) {
            return (
                <TouchableOpacity
                    style={styles.addButton}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={handleAddOrUpdate}
                >
                    <Text style={styles.addButtonText}>ADD</Text>
                    <Text style={styles.plusSign}>+</Text>
                </TouchableOpacity>
            )
        }

        return (
            <View style={styles.quantityContainer}>
                <TouchableOpacity style={styles.quantityButton} onPress={handleDecrement}>
                    <Icon name="minus" size={16} color="#E23744" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity style={styles.quantityButton} onPress={handleAddOrUpdate}>
                    <Icon name="plus" size={16} color="#E23744" />
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleValue }] }]}>
            <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('restaurants_page', { item: item?.restaurant_id?._id })} style={styles.contentContainer}>

                <View style={styles.leftContent}>
                    <View style={styles.headerContainer}>
                        <Icon
                            name={item.food_category === "Veg" ? "circle-slice-8" : "food-drumstick"}
                            size={16}
                            color={item.food_category === "Veg" ? "#4CAF50" : "#E23744"}
                            style={styles.categoryIcon}
                        />
                        {item?.restaurant_id?.restaurant_in_top_list ? (
                            <View style={styles.bestsellerContainer}>
                                <Text style={styles.bestsellerText}>Bestseller</Text>
                            </View>
                        ) : (
                            <View style={styles.bestsellerContainer}>
                                <Text style={styles.bestsellerText}>New Opening</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.title}>{item.food_name}</Text>

                    <Text style={styles.ratingText}>{item?.restaurant_id?.restaurant_name}</Text>
                    <View style={styles.ratingContainer}>
                        <Icon name="star" size={16} color="#F4C430" />
                        <Text style={styles.ratingText}>4.2</Text>
                        <Text style={styles.ratingCount}>(200+)</Text>
                    </View>

                    <Text style={styles.price}>₹{Math.round(item.food_price)}</Text>

                    <Text style={styles.description} numberOfLines={2}>
                        {item.description}
                    </Text>
                    {isAddAble && (
                        <>
                            {item.what_includes && item.what_includes.length > 0 && (
                                <Text style={styles.includes}>Includes: {item.what_includes.join(", ")}</Text>
                            )}
                        </>
                    )}

                </View>

                {item?.food_availability ? (
                    <View style={styles.rightContent}>
                        <Image source={{ uri: item?.images?.url }} style={styles.image} />
                        {isAddAble && renderAddButton()}
                        {isAddAble ? null : (
                            <>
                                {item.what_includes && item.what_includes.length > 0 && (
                                    <Text style={styles.includes}>Includes: {item.what_includes.join(", ")}</Text>
                                )}
                            </>
                        )}

                        <Text style={styles.customizable}>customisable</Text>
                    </View>
                ) : (
                    <View style={styles.rightContent}>
                        <Image source={{ uri: item.images.url }} style={styles.image} />
                        <Text style={styles.notAvalaible}>Food Not Available RIght This</Text>
                    </View>
                )}

            </TouchableOpacity>
            <View style={styles.divider} />
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 16,
    },
    contentContainer: {
        flexDirection: "row",
        paddingHorizontal: 16,
    },
    leftContent: {
        flex: 1,
        marginRight: 12,
    },
    headerContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    categoryIcon: {
        marginRight: 8,
    },
    bestsellerContainer: {
        backgroundColor: "#FFF3E0",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    bestsellerText: {
        color: "#FF9800",
        fontSize: 12,
        fontWeight: "500",
    },
    title: {
        fontSize: 17,
        fontWeight: "600",
        color: "#1C1C1C",
        marginBottom: 4,
    },
    ratingContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#1C1C1C",
        marginLeft: 4,
    },
    ratingCount: {
        fontSize: 12,
        color: "#666666",
        marginLeft: 4,
    },
    price: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1C1C1C",
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: "#666666",
        marginBottom: 4,
        lineHeight: 20,
    },
    includes: {
        fontSize: 13,
        color: "#666666",
        fontStyle: "italic",
    },
    rightContent: {
        width: 120,
        alignItems: "center",
    },
    image: {
        width: 120,
        height: 96,
        borderRadius: 8,
        marginBottom: 8,
    },
    addButton: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E23744",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
    },
    addButtonText: {
        color: "#E23744",
        fontSize: 14,
        fontWeight: "600",
        marginRight: 4,
    },
    plusSign: {
        color: "#E23744",
        fontSize: 14,
        fontWeight: "600",
    },
    customizable: {
        fontSize: 12,
        color: "#666666",
        marginTop: 4,
    },
    divider: {
        height: 1,
        backgroundColor: "#E0E0E0",
        marginTop: 16,
    },
    quantityContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E23744",
        borderRadius: 8,
        overflow: "hidden",
        width: "100%",
    },
    quantityButton: {
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
        width: 36,
    },
    quantityText: {
        flex: 1,
        textAlign: "center",
        fontSize: 14,
        fontWeight: "600",
        color: "#E23744",
    },
    notAvalaible: {
        color: "#666666",
        fontSize: 12

    }
})

export default Food_Card

