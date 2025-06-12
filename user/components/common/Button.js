import React from 'react';
import { 
    TouchableOpacity, 
    Text, 
    ActivityIndicator, 
    StyleSheet 
} from 'react-native';
import { COLORS } from '../../constants/colors';

const Button = ({
    onPress,
    children,
    loading = false,
    disabled = false,
    variant = 'primary', // Default is 'primary'
    style
}) => {
    const buttonStyles = [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'outline' && styles.buttonOutline,
        variant === 'danger' && styles.buttonDanger,
        variant === 'success' && styles.buttonSuccess,
        variant === 'dark' && styles.buttonDark,
        variant === 'light' && styles.buttonLight,
        (disabled || loading) && styles.buttonDisabled,
        style,
    ];

    const textStyles = [
        styles.text,
        variant === 'secondary' && styles.textSecondary,
        variant === 'outline' && styles.textOutline,
        variant === 'danger' && styles.textDanger,
        variant === 'success' && styles.textSuccess,
        variant === 'dark' && styles.textDark,
        variant === 'light' && styles.textLight,
        (disabled || loading) && styles.textDisabled,
    ];

    return (
        <TouchableOpacity
            style={buttonStyles}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'outline' ? COLORS.primary : COLORS.white} />
            ) : (
                <Text style={textStyles}>{children}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 56,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonSecondary: {
        backgroundColor: COLORS.secondary,
    },
    buttonOutline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    buttonDanger: {
        backgroundColor: COLORS.error,
    },
    buttonSuccess: {
        backgroundColor: COLORS.success,
    },
    buttonDark: {
        backgroundColor: COLORS.dark,
    },
    buttonLight: {
        backgroundColor: COLORS.light,
        borderWidth: 2,
        borderColor: COLORS.secondary,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    text: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
    textSecondary: {
        color: COLORS.white,
    },
    textOutline: {
        color: COLORS.primary,
    },
    textDanger: {
        color: COLORS.white,
    },
    textSuccess: {
        color: COLORS.white,
    },
    textDark: {
        color: COLORS.white,
    },
    textLight: {
        color: COLORS.secondary,
    },
    textDisabled: {
        color: COLORS.white,
    },
});

export default Button;
