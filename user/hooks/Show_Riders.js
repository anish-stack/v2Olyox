import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../context/SocketContext";

const useShowRiders = (location) => {
    const [riders, setRiders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { isConnected, socket } = useSocket(); // Directly destructure socket
    const [fetching, setFetching] = useState(false);  // Track if a request is in progress

    // Vehicle list (for generating fake riders)
    const vehicleList = [
        { vehicleName: "SUV", vehicleType: "car", description: "Prime and Luxey Car", time: "5 min", priceRange: 14 },
        { vehicleName: "SEDAN", vehicleType: "car", description: "Comfy, economical cars", time: "1 min", priceRange: 12 },
        { vehicleName: "MINI", vehicleType: "car", description: "Comfy, economical cars", time: "1 min", priceRange: 11 },
        { vehicleName: "AUTO", vehicleType: "auto", description: "Affordable and quick rides", time: "2 min", priceRange: 9 },
        { vehicleName: "Bike", vehicleType: "2 wheeler", description: "Lets beat traffic", time: "2 min", priceRange: 4 },
    ];

    // Function to generate fake riders
    const generateFakeRiders = () => {
        const fakeRiders = [];
        for (let i = 0; i < 5; i++) {
            const vehicle = vehicleList[Math.floor(Math.random() * vehicleList.length)];
            fakeRiders.push({
                location: {
                    type: "Point",
                    coordinates: [
                        location.longitude + (Math.random() - 0.5) * 0.02, // Random longitude variation near user
                        location.latitude + (Math.random() - 0.5) * 0.02, // Random latitude variation near user
                    ],
                },
                rideVehicleInfo: {
                    vehicleName: vehicle.vehicleName,
                    vehicleType: vehicle.vehicleType,
                    PricePerKm: vehicle.priceRange,
                    RcExpireDate: new Date(Date.now() + Math.random() * 10000000000).toISOString(),
                    VehicleNumber: `ABC${Math.floor(Math.random() * 1000)}`,
                    VehicleImage: [
                        "https://via.placeholder.com/150", 
                        "https://via.placeholder.com/150",
                    ],
                },
                riderType: "fake", // Add riderType as "fake"
            });
        }
        return fakeRiders;
    };

    // Fetch riders from the socket
    const fetchRidersViaSocket = useCallback(() => {
        if (isConnected && socket() && !fetching) {
            setLoading(true);
            setFetching(true);  // Set fetching state to true

            console.log("Emitting 'show_me_available_riders' event");

            // Emit event to get available riders
            socket().emit("show_me_available_riders", { user_location: location });

            // Listen for the response (make sure it's only listened to once)
            socket().once("available_riders", (response) => {
                console.log("Received available_riders response:", response);

                if (response?.error) {
                    setError(response.error);
                    setLoading(false);
                    setFetching(false);  // Reset fetching state after request completes
                } else {
                    const realRiders = response.map((rider) => ({
                        ...rider,
                        riderType: "real", // Add riderType as "real"
                    }));
                    setRiders(realRiders);
                    setLoading(false);
                    setFetching(false);  // Reset fetching state after request completes
                }
            });

            // Listen for error events
            socket().once("error", (errorResponse) => {
                console.log("Error from server:", errorResponse);
                setError(errorResponse.message);
                setLoading(false);
                setFetching(false);  // Reset fetching state after request completes
            });
        }
    }, [location, isConnected, socket(), fetching]);

    // Effect to fetch riders when the component mounts or location changes
    useEffect(() => {
        if (isConnected && !fetching) {
            fetchRidersViaSocket();
        }
    }, [location, isConnected, fetching, fetchRidersViaSocket]);

    // If no riders are available or if there's an error, generate fake riders
    useEffect(() => {
        if ((riders.length === 0 || error) && !loading) {
            const fakeRiders = generateFakeRiders();
            setRiders(fakeRiders);
            setError(null);  // Clear the error message
        }
    }, [riders, error, loading]);

    return { riders, loading, error };
};

export default useShowRiders;
