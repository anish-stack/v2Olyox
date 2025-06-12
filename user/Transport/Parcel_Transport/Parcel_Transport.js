import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import React from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'

export default function Parcel_Transport() {
    const navigation = useNavigation()
    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#fff5f5', '#ffe3e3']}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    <View style={styles.imageContainer}>
                        <Image
                            source={{ uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/red-OtVVgekRiEfKs4LyAzPC99ddEiEYmB.png" }}
                            style={styles.image}
                            resizeMode="contain"
                        />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>Swift Food Delivery at Your Fingertips!</Text>
                        <Text style={styles.subtitle}>
                            Experience lightning-fast, secure deliveries with Olyox Premium Service
                        </Text>
                        <View style={styles.highlightContainer}>
                            <Text style={styles.highlight}>✓ Fast delivery</Text>
                            <Text style={styles.highlight}>✓ Real-time tracking</Text>
                           
                        </View>
                        {/* <Text style={styles.pricing}>Starting at just ₹70/km</Text> */}
                        <View style={{ alignItems: 'center', justifyContent: 'center', alignContent: 'center', width: '100%' }}>
                            <TouchableOpacity onPress={() => navigation.navigate('Book-Parcel')} style={styles.button}>
                                <Text style={styles.buttonText}>
                                    Send Order Now
                                </Text>
                            </TouchableOpacity>
                        </View>

                    </View>

                </View>
            </LinearGradient>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    gradient: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#e51e25',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
        marginBottom: 20,
    },
    highlightContainer: {
        marginBottom: 20,
    },
    highlight: {
        fontSize: 15,
        color: '#444',
        marginBottom: 8,
        fontWeight: '500',
    },
    pricing: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#e51e25',
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#e51e25',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        alignItems: 'center',
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '80%',
        height: 200,
    }
})
