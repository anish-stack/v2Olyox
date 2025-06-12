import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons"; // Import Expo Vector Icons
import { COLORS } from "../../../constants/colors";

const HeaderWithBack = ({ title }) => {
    const navigation = useNavigation();

    return (
        <View style={styles.header}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                <Text style={styles.title}>{title || "Header"}</Text>
            </TouchableOpacity>

            {/* User Icon */}
            <TouchableOpacity>
                <MaterialIcons name="person-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        marginBottom: 10,
        backgroundColor: COLORS.background,
        paddingVertical: 16,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomColor: COLORS.shadow,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: COLORS.text,
        marginLeft: 8, // Space between the icon and text
    },
});

export default HeaderWithBack;
