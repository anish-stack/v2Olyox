"use client"

import { useEffect, useRef, useState } from "react"
import {
    View,
    TouchableOpacity,
    Text,
    Image,
    StyleSheet,
    Animated,
    Dimensions,
    Easing,
    ImageBackground,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons"

const { width, height } = Dimensions.get("window")

export default function BookARide() {
    const navigation = useNavigation()

    // Animation values
    const carAnimation = useRef(new Animated.Value(0)).current
    const buttonAnimation = useRef(new Animated.Value(0)).current
    const fadeAnimation = useRef(new Animated.Value(0)).current
    const pulseAnimation = useRef(new Animated.Value(1)).current

    // Road animation
    const roadPosition = useRef(new Animated.Value(0)).current

    // Particle animations for the "speed lines"
    const particles = useRef(
        [...Array(15)].map(() => ({
            position: new Animated.Value(Math.random() * width),
            speed: 2 + Math.random() * 5,
            height: 5 + Math.random() * 20,
            opacity: new Animated.Value(0),
        })),
    ).current

    // State for active ride options
    const [activeOption, setActiveOption] = useState("standard")

    // Ride options data
    const rideOptions = [
        {
            id: "standard",
            name: "Standard",
            price: "$10-15",
            icon: "car-side",
            time: "5 min",
        },
        {
            id: "premium",
            name: "Premium",
            price: "$18-24",
            icon: "car-sport",
            time: "8 min",
        },
        {
            id: "xl",
            name: "XL",
            price: "$22-30",
            icon: "truck",
            time: "10 min",
        },
    ]

    useEffect(() => {
        // Initial fade in
        Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start()

        // Car animation
        const animateCar = () => {
            Animated.sequence([
                Animated.timing(carAnimation, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                    useNativeDriver: true,
                }),
                Animated.timing(carAnimation, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                    useNativeDriver: true,
                }),
            ]).start(() => animateCar())
        }

        // Button pulse animation
        const animateButton = () => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnimation, {
                        toValue: 1.05,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnimation, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ]),
            ).start()
        }

        // Road animation
        const animateRoad = () => {
            Animated.loop(
                Animated.timing(roadPosition, {
                    toValue: -width,
                    duration: 3000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ).start()
        }

        // Animate particles
        const animateParticles = () => {
            particles.forEach((particle) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(particle.opacity, {
                            toValue: 0.7,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(particle.opacity, {
                            toValue: 0,
                            duration: 800,
                            useNativeDriver: true,
                        }),
                    ]),
                ).start()
            })
        }

        // Start all animations
        animateCar()
        animateButton()
        animateRoad()
        animateParticles()

        // Button entrance animation
        Animated.spring(buttonAnimation, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start()

        // Cleanup animations on unmount
        return () => {
            carAnimation.stopAnimation()
            buttonAnimation.stopAnimation()
            fadeAnimation.stopAnimation()
            pulseAnimation.stopAnimation()
            roadPosition.stopAnimation()
            particles.forEach((p) => p.opacity.stopAnimation())
        }
    }, [])

    // Car animation interpolations
    const carTranslateY = carAnimation.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -10, 0],
    })

    const carRotate = carAnimation.interpolate({
        inputRange: [0, 0.25, 0.75, 1],
        outputRange: ["0deg", "1deg", "-1deg", "0deg"],
    })

    // Button animation interpolations
    const buttonScale = buttonAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1],
    })

    const buttonOpacity = buttonAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    })

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnimation }]}>
            <ImageBackground
                source={require("../../assets/Book_Ride/city-skyline.jpeg")}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.7)"]}
                    style={styles.gradientOverlay}
                >
                    {/* Road with animation */}
                    <View style={styles.roadContainer}>
                        <Animated.View
                            style={[
                                styles.roadMarkings,
                                {
                                    transform: [{ translateX: roadPosition }],
                                },
                            ]}
                        >
                            {[...Array(20)].map((_, i) => (
                                <View key={i} style={styles.roadLine} />
                            ))}
                        </Animated.View>


                    </View>

                    {/* Car with animation */}
                    <Animated.View
                        style={[
                            styles.carContainer,

                        ]}
                    >
                        <Image
                            source={require('./taxi.png')}
                            style={styles.carImage} resizeMode="contain" />

                        {/* Car shadow */}
                        <View style={styles.carShadow} />
                    </Animated.View>



                    {/* Book button with animation */}
                    <Animated.View
                        style={[
                            styles.buttonContainer,
                            {
                                opacity: buttonOpacity,
                                transform: [{ scale: buttonScale }, { scale: pulseAnimation }],
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => navigation.navigate("Start_Booking_Ride")}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={["#FF6B6B", "#FF8E53"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.buttonText}>Book a Ride Now</Text>
                                <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Additional info */}
                    <View style={styles.infoContainer}>
                        <View style={styles.infoItem}>
                            <MaterialIcons name="verified" size={16} color="#4CAF50" />
                            <Text style={styles.infoText}>Verified Drivers</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <MaterialIcons name="security" size={16} color="#4CAF50" />
                            <Text style={styles.infoText}>Secure Rides</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <MaterialIcons name="local-offer" size={16} color="#4CAF50" />
                            <Text style={styles.infoText}>Best Prices</Text>
                        </View>
                    </View>
                </LinearGradient>
            </ImageBackground>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
        borderRadius: 20,
        overflow: "hidden",
        margin: 16,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    backgroundImage: {
        flex: 1,
        width: "100%",
    },
    gradientOverlay: {
        flex: 1,
        padding: 20,
        justifyContent: "space-between",
    },
    roadContainer: {
        height: 40,
        backgroundColor: "#333333",
        borderRadius: 4,
        marginTop: 20,
        overflow: "hidden",
        position: "relative",
    },
    roadMarkings: {
        flexDirection: "row",
        position: "absolute",
        height: "100%",
        width: width * 2,
    },
    roadLine: {
        width: 30,
        height: 4,
        backgroundColor: "#FFFFFF",
        marginHorizontal: 20,
        alignSelf: "center",
    },
    particle: {
        position: "absolute",
        width: 2,
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        top: 10,
    },
    carContainer: {
        alignSelf: "center",
        marginTop: -60,
        marginBottom: 20,
        zIndex: 10,
    },
    carImage: {
        width: 120,
        height: 60,
    },

    optionsContainer: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        borderRadius: 16,
        padding: 16,
        marginVertical: 20,
    },
    optionsTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333333",
        marginBottom: 12,
    },
    optionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    optionCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 4,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#EEEEEE",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    activeOptionCard: {
        backgroundColor: "#FF6B6B",
        borderColor: "#FF6B6B",
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F5F5F5",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    activeOptionIconContainer: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    optionName: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#333333",
        marginBottom: 4,
    },
    optionPrice: {
        fontSize: 12,
        color: "#666666",
        marginBottom: 6,
    },
    activeOptionText: {
        color: "#FFFFFF",
    },
    optionTimeContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.05)",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    optionTime: {
        fontSize: 10,
        color: "#777777",
        marginLeft: 2,
    },
    buttonContainer: {
        alignItems: "center",
        marginVertical: 20,
    },
    button: {
        width: "50%",
        borderRadius: 30,
        overflow: "hidden",
        elevation: 5,
        shadowColor: "#FF6B6B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    buttonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "bold",
        marginRight: 8,
    },
    infoContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    infoItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    infoText: {
        fontSize: 12,
        color: "#333333",
        marginLeft: 4,
    },
})

