import React from "react";
import { View, TextInput, StyleSheet, Text } from "react-native";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from "../../constants/colors";



const Input = ({
    icon,
    placeholder,
    iconColour,
    secureTextEntry = false,
    onChangeText,
    value,
    keyboardType = "default",
    error
}) => {
    return (
        <View>
            <View style={[styles.inputContainer, error && styles.inputError]}>
                <Icon
                    name={icon}
                    size={14}
                    color={error ? COLORS.zom : iconColour}
                    style={styles.icon}
                />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    secureTextEntry={secureTextEntry}
                    onChangeText={onChangeText}
                    value={value}
                    keyboardType={keyboardType}
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        // borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginVertical: 8,
        // borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 1,
    },
    inputError: {
        borderColor: COLORS.error,
        borderWidth: 1,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        padding: 0,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 12,
        marginLeft: 16,
        marginTop: 4,
    }
});

export default Input;