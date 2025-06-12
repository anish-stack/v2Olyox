import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
const GuestContext = createContext();

export const useGuest = () => useContext(GuestContext);

export const GuestProvider = ({ children }) => {
    const [isGuest, setIsGuest] = useState(false);

    const [defaultGuestData, setDefaultGuestData] = useState({
        name: "Guest",
        number: "XXXXXXXXXX",
        email: "guest@example.com",
        profile:
            "https://res.cloudinary.com/dglihfwse/image/upload/v1744797398/id-card_wt20u0.png",
        guest: true,
    });

    useEffect(() => {
        const fetchGuestData = async () => {
            try {
                const savedGuestData = await SecureStore.getItemAsync("guestData");
                if (savedGuestData) {
                    setDefaultGuestData(JSON.parse(savedGuestData));
                    setIsGuest(true);
                }
            } catch (error) {
                console.error("Failed to fetch guest data from SecureStore:", error);
            }
        };

        fetchGuestData();
    }, []);

    useEffect(() => {
        const saveGuestData = async () => {
            try {
                if (isGuest) {
                    await SecureStore.setItemAsync("guestData", JSON.stringify(defaultGuestData));
                } else {
                    await SecureStore.deleteItemAsync("guestData");
                }
            } catch (error) {
                console.error("Failed to save guest data to SecureStore:", error);
            }
        };

        saveGuestData();
    }, [isGuest, defaultGuestData]);
    const handleGuestLogin = () => {
        setIsGuest(true);
        return true
    };

    const handleGuestLogout = () => {
        setIsGuest(false);
        setDefaultGuestData({
            name: "Guest",
            number: "XXXXXXXXXX",
            email: "guest@example.com",
            profile:
                "https://res.cloudinary.com/dglihfwse/image/upload/v1744797398/id-card_wt20u0.png",
            guest: true,
        });
    };

    const getGuest = () => {
        return defaultGuestData;
    };

    return (
        <GuestContext.Provider
            value={{
                isGuest,
                defaultGuestData,
                handleGuestLogin,
                handleGuestLogout,
                getGuest,
            }}
        >
            {children}
        </GuestContext.Provider>
    );
};
