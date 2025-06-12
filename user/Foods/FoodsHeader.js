import React from "react"
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"

export default function FoodsHeader({ onSearch }) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.searchContainer}>
                    <Icon name="magnify" size={24} color="#757575" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for dishes..."
                        placeholderTextColor="#757575"
                        onChangeText={onSearch}
                    />
                </View>
                {/* <View style={styles.bottomRow}>
                    <TouchableOpacity onPress={()=>onSearch("Top Rated")} style={styles.bottomButton}>
                        <Icon name="silverware-fork-knife" size={20} color="#E23744" />
                        <Text style={styles.bottomButtonText}>Delivery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>onSearch("Top Rated")} style={styles.bottomButton}>
                        <Icon name="star" size={20} color="#E23744" />
                        <Text style={styles.bottomButtonText}>Top Rated</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>onSearch(Packages)} style={styles.bottomButton}>
                        <Icon name="thumb-up" size={20} color="#E23744" />
                        <Text style={styles.bottomButtonText}>Packages</Text>
                    </TouchableOpacity>
                </View> */}
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: "#FFFFFF",
    },
    container: {
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E0E0E0",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F5F5F5",
        borderRadius: 8,
        padding: 8,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#333333",
    },
    bottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    bottomButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF1F2",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    bottomButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: "600",
        color: "#E23744",
    },
})

