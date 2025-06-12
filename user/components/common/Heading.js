import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import { COLORS } from '../../COLORS/COLORS';

export default function MainHeading({ text, size = 'medium', COLORScheme = 'primary' }) {
    const fontSize = {
        small: 16,
        medium: 20,
        large: 24,
    };

    const color = {
        primary: COLORS.text,
        secondary: '#6366F1',
    };

    return (
        <View style={styles.container}>
            <Text
                style={[
                    styles.heading,
                    {
                        fontSize: fontSize[size], // Select appropriate font size
                        color: color[COLORScheme], // Select appropriate color
                    },
                ]}
            >
                {text}
            </Text>
            <Icon
                name="chevron-small-left"
                size={24} // Set a fixed size for the icon
                color={color[COLORScheme]} // Use selected color
                style={styles.chevron}
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginVertical: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        ...Platform.select({
            android: {
                elevation: 1,
            },
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
        }),
    },
    heading: {
        flex: 1,
        fontWeight: 'bold',
        textTransform: 'capitalize',
        overflow: 'hidden',
    },
    chevron: {
        marginLeft: 8,
    },
});
