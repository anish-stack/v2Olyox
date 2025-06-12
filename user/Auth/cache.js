import * as SecureStore from 'expo-secure-store';

// Create a token cache utility
const createTokenCache = () => {
    return {
        // Get a token from Secure Store
        getToken: async (key) => {
            try {
                const item = await SecureStore.getItemAsync(key);
                if (item) {
                    console.log(`${key} was used 🔐 \n`);
                } else {
                    console.log('No values stored under key: ' + key);
                }
                return item;
            } catch (error) {
                console.error('Secure store get item error: ', error);
                return null;
            }
        },

        // Save a token to Secure Store
        saveToken: async (key, token) => {
            try {
                console.log("save key:", key);
                console.log("save token:", token);
                
                await SecureStore.setItemAsync(key, token);
                
                console.log("Token successfully saved! 🔐");

                
                return token; // Explicitly return the token
            } catch (error) {
                console.error("Error saving token:", error);
                return null;
            }
        },

        save_location: async(key,location)=>{
            try {
                console.log("save key:", key);
                console.log("save location:", location);
                
                await SecureStore.setItemAsync(key, location);
                
                console.log("location successfully saved! 🔐");

                
                return location; // Explicitly return the token
            } catch (error) {
                console.error("Error saving location:", error);
                return null;
            }
        },
        get_location: async(key)=>{
            try {
                const item = await SecureStore.getItemAsync(key);
                if (item) {
                    console.log(`${key} was used 🔐 \n`);
                } else {
                    console.log('No values stored under key: ' + key);
                }
                return item;
            } catch (error) {
                console.error('Secure store get item error: ', error);
                return null;
            }
        },

        // Delete a token from Secure Store
        deleteToken: async (key) => {
            try {
                await SecureStore.deleteItemAsync(key);
                console.log(`${key} deleted 🔐`);
            } catch (error) {
                console.error('Secure store delete item error: ', error);
            }
        },
    };
};

// Only use SecureStore for non-web platforms
export const tokenCache = createTokenCache();
