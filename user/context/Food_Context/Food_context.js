import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Create Context
const FoodContext = createContext();

// FoodContext Provider
export const FoodProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  // Load data from AsyncStorage on initial render
  useEffect(() => {
    const loadCart = async () => {
      try {
        const storedCart = await AsyncStorage.getItem("cart");
        if (storedCart) {
          setCart(JSON.parse(storedCart));
        }
      } catch (error) {
        console.error("Error loading cart from storage:", error);
      }
    };
    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem("cart", JSON.stringify(cart));
      } catch (error) {
        console.error("Error saving cart to storage:", error);
      }
    };
    saveCart();
  }, [cart]);

  // Add food item to cart
  const addFood = (food) => {
    const existingItem = cart.find((item) => item._id === food._id);
    if (existingItem) {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item._id === food._id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart((prevCart) => [...prevCart, { ...food, quantity: 1 }]);
    }
  };

  // Remove food item from cart
  const removeFood = (id) => {
    console.log(id)
    setCart((prevCart) => prevCart.filter((item) => item._id !== id));
  };

  // Update the quantity of a food item
  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFood(id); // Remove item if quantity is 0
    } else {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item._id === id ? { ...item, quantity } : item
        )
      );
    }
  };

  // Clear the cart
  const clearCart = () => {
    setCart([]);
  };

  return (
    <FoodContext.Provider
      value={{
        cart,
        addFood,
        removeFood,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </FoodContext.Provider>
  );
};

// Custom Hook for Using Food Context
export const useFood = () => useContext(FoodContext);
