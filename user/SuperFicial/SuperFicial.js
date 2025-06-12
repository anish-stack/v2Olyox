import React, { useEffect, useRef, useMemo, useState } from "react"
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, ScrollView, Dimensions, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { PanGestureHandler, State } from "react-native-gesture-handler"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"
import { useFood } from "../context/Food_Context/Food_context"
import { useGuest } from "../context/GuestLoginContext"

const { width, height } = Dimensions.get("window")

export default function SuperFicial({ restaurant_id }) {
    const navigation = useNavigation()
    const translateY = useRef(new Animated.Value(height)).current
    const lastGestureDy = useRef(0)
    const [isVisible, setIsVisible] = useState(true)
    const { isGuest } = useGuest()
    const { cart, removeFood, updateQuantity } = useFood()

    const totalAmount = useMemo(() => {
        return cart.reduce((total, item) => total + item.food_price * item.quantity, 0)
    }, [cart])

    useEffect(() => {
        if (cart.length > 0 && isVisible) {
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
            }).start()
        } else {
            Animated.spring(translateY, {
                toValue: height,
                useNativeDriver: true,
            }).start()
        }
    }, [cart, translateY, isVisible])

    const handleGesture = Animated.event([{ nativeEvent: { translationY: translateY } }], { useNativeDriver: true })

    const onHandlerStateChange = (event) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            lastGestureDy.current += event.nativeEvent.translationY

            if (lastGestureDy.current > height / 2) {
                setIsVisible(false)
            } else {
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                }).start()
            }

            lastGestureDy.current = 0
        }
    }

    const handleViewAll = () => {

        navigation.navigate("FullCart")
    }

    const handleCheckout = () => {
        if (isGuest) {
            Alert.alert(
                "Create an Account to Continue",
                "To place a food order, please create an account. It only takes a moment, and you'll be all set to enjoy your meal!",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            navigation.navigate("Onboarding");
                        },
                    },
                    {
                        text: "Cancel",
                        onPress: () => {
                            navigation.goBack();
                        },
                    },
                ],
                { cancelable: false }
            );
        } else {
            const check_out_data_prepare = {
                items: cart,
                total_amount: totalAmount,
                restaurant: restaurant_id,
            };
    
            navigation.navigate("Checkout", { data: check_out_data_prepare });
        }
    };
    

    const handleRemoveItem = (itemId) => {
        removeFood(itemId)
    }

    const handleClose = () => {
        setIsVisible(false)
    }

    const handleOpenCart = () => {
        setIsVisible(true)
    }

    if (cart.length === 0) return null

    const displayedItems = cart.slice(0, 4)
    const remainingItems = cart.length - 4

    return (
        <>
            <PanGestureHandler onGestureEvent={handleGesture} onHandlerStateChange={onHandlerStateChange}>
                <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
                    <View style={styles.header}>
                        <View style={styles.handle} />
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Icon name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.itemsContainer}
                        decelerationRate="fast"
                        snapToInterval={width * 0.25}
                        snapToAlignment="start"
                    >
                        {displayedItems.map((item) => (
                            <View key={item._id} style={styles.itemCard}>
                                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveItem(item._id)}>
                                    <Icon name="close" size={14} color="#FFFFFF" />
                                </TouchableOpacity>
                                <Image source={{ uri: item.images.url }} style={styles.itemImage} />
                                <Text style={styles.itemTitle} numberOfLines={1}>
                                    {item.food_name}
                                </Text>
                            </View>
                        ))}
                        {remainingItems > 0 && (
                            <View style={styles.itemCard}>
                                <View style={styles.moreItemsCircle}>
                                    <Text style={styles.moreItemsText}>+{remainingItems}</Text>
                                </View>
                                <Text style={styles.moreItemsLabel}>More</Text>
                            </View>
                        )}
                    </ScrollView>
                    <View style={styles.bottomContainer}>
                        <TouchableOpacity onPress={handleViewAll} style={styles.viewAllButton}>
                            <Text style={styles.viewAllText}>View All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCheckout} style={styles.checkoutButton}>
                            <Text style={styles.checkoutText}>Checkout • ₹{totalAmount.toFixed(2)}</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </PanGestureHandler>
            {!isVisible && (
                <TouchableOpacity style={styles.cartIcon} onPress={handleOpenCart}>
                    <Icon name="cart" size={24} color="#FFFFFF" />
                    <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{cart.length}</Text>
                    </View>
                </TouchableOpacity>
            )}
        </>
    )
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 10,
        paddingBottom: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: "#E0E0E0",
        borderRadius: 3,
    },
    closeButton: {
        padding: 5,
    },
    itemsContainer: {
        paddingHorizontal: 15,
    },
    itemCard: {
        marginRight: 15,
        alignItems: "center",
        width: width * 0.25 - 15,
        position: "relative",
    },
    removeButton: {
        position: "absolute",
        top: 0,
        right: 0,
        backgroundColor: "#E23744",
        borderRadius: 12,
        width: 20,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 5,
    },
    itemTitle: {
        fontSize: 12,
        fontWeight: "500",
        textAlign: "center",
        marginBottom: 2,
    },
    moreItemsCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#E23744",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 5,
    },
    moreItemsText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "bold",
    },
    moreItemsLabel: {
        fontSize: 12,
        fontWeight: "500",
        textAlign: "center",
    },
    bottomContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 15,
        paddingHorizontal: 15,
    },
    viewAllButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#E23744",
    },
    viewAllText: {
        color: "#E23744",
        fontWeight: "600",
    },
    checkoutButton: {
        backgroundColor: "#E23744",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    checkoutText: {
        color: "#FFFFFF",
        fontWeight: "600",
    },
    cartIcon: {
        position: "absolute",
        bottom: 20,
        right: 20,
        backgroundColor: "#E23744",
        borderRadius: 30,
        width: 60,
        height: 60,
        justifyContent: "center",
        alignItems: "center",
    },
    cartBadge: {
        position: "absolute",
        top: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    cartBadgeText: {
        color: "#E23744",
        fontSize: 12,
        fontWeight: "bold",
    },
})

