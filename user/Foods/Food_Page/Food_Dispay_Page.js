import React, { useCallback, useState, useEffect } from "react"
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from "react-native"
import { useRoute } from "@react-navigation/native"
import axios from "axios"
import Food_Card from "../Food_Card/Food_Card"
import FoodsHeader from "../FoodsHeader"
import { useFood } from "../../context/Food_Context/Food_context"
import { ScrollView } from "react-native"

export default function Food_Display_Page() {
    const route = useRoute()
    const [error, setError] = useState("")
    const [foodData, setFoodData] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const { title } = route.params || {}
    const { cart, addFood, updateQuantity } = useFood()

    const fetchFoods = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get(
                `http://192.168.1.6:3100/api/v1/tiffin/find_Restaurant_foods?food_category=${title}`,
            )
            if (data.data) {
                console.log(data.data[0])
                setFoodData(data.data)
            } else {
                setFoodData([])
            }
        } catch (error) {
            setError("Unable to fetch food data. Please try again.")
        } finally {
            setLoading(false)
        }
    }, [title])

    useEffect(() => {
        fetchFoods()
    }, [fetchFoods])

    const handleSearch = (query) => {
        setSearchQuery(query)
       
    }

    const filteredFoodData = foodData
        .filter((item) => {
            console.log(item.restaurant_id?.rating)
            if (searchQuery === "Top Rated") {
                return item.restaurant_id?.rating !== undefined;
            }
            return (
                item.food_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase())
            );
        })
        .sort((a, b) => {
            if (searchQuery === "Top Rated") {

                return (b.restaurant_id?.rating || 0) - (a.restaurant_id?.rating || 0);
            }
            return 0; // No sorting for normal search
        });


    const renderFood = ({ item }) => (
        <Food_Card
            item={item}
            cart={cart}
            addFood={addFood}
            updateQuantity={updateQuantity}
        />
    )

    const ListEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            {/* <Image source={require("./assets/empty-plate.png")} style={styles.emptyImage} /> */}
            <Text style={styles.emptyText}>No food items found</Text>
        </View>
    )

    return (
        <View style={styles.container}>
            <FoodsHeader onSearch={handleSearch} />

            <ScrollView>

                {loading ? (
                    <ActivityIndicator size="large" color="#E23744" style={styles.loader} />
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchFoods}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        {filteredFoodData.length > 0 ? (
                            filteredFoodData.map((item) => (
                                <View key={item._id} style={styles.foodItem}>
                                    {renderFood({ item })}
                                </View>
                            ))
                        ) : (
                            <ListEmptyComponent />
                        )}
                    </View>

                )}
            </ScrollView>

        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F8F8",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        padding: 16,
    },
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContent: {
        padding: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    errorText: {
        fontSize: 16,
        color: "#E23744",
        textAlign: "center",
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: "#E23744",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    emptyImage: {
        width: 150,
        height: 150,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        color: "#666",
        textAlign: "center",
    },
})

