import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { initializeSocket, cleanupSocket, getSocket } from "../services/socketService";
import { find_me } from "../utils/helpers";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastConnectedAt, setLastConnectedAt] = useState(null);
  const [socketInstance, setSocketInstance] = useState(null);
  const socketInitialized = useRef(false);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await find_me();

        if (data?.user?._id) {
          setUser(data.user._id);
        } else {
          console.warn("⚠️ No user found");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Initialize and manage socket
  // useEffect(() => {
  //   if (!user) return;

  //   const setupSocket = () => {
  //     try {
  //       console.log("🚀 Initializing socket for user:", user);

  //       // Clean up any existing socket first
  //       if (socketInitialized.current) {
  //         cleanupSocket();
  //       }

  //       const socket = initializeSocket({ userId: user });
  //       setSocketInstance(socket);
  //       socketInitialized.current = true;

  //       // Set up event listeners for connection state
  //       socket.on('connect', () => {
  //         console.log("🔌 Socket connected");
  //         setIsConnected(true);
  //         setLastConnectedAt(new Date());
  //         reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection

  //         // Clear any pending reconnection timers when connected
  //         if (reconnectTimerRef.current) {
  //           clearTimeout(reconnectTimerRef.current);
  //           reconnectTimerRef.current = null;
  //         }
  //       });

  //       socket.on('disconnect', (reason) => {
  //         console.log(`❌ Socket disconnected: ${reason}`);
  //         setIsConnected(false);

  //         // Some disconnect reasons should trigger automatic reconnect
  //         if (reason === 'io server disconnect') {
  //           // The server has forcefully disconnected the socket
  //           socket.connect();
  //         }
  //         // Other reasons will be handled by our reconnection effect
  //       });

  //       socket.on('connect_error', (err) => {
  //         console.error("🚨 Socket connection error:", err);
  //         setIsConnected(false);
  //       });

  //       return socket;
  //     } catch (error) {
  //       console.error("Error setting up socket:", error);
  //       socketInitialized.current = false;
  //       setSocketInstance(null);
  //       return null;
  //     }
  //   };

  //   const socket = setupSocket();

  //   return () => {
  //     if (socket) {
  //       console.log("🛑 Cleaning up socket on unmount...");
  //       socket.off('connect');
  //       socket.off('disconnect');
  //       socket.off('connect_error');
  //       cleanupSocket();
  //       socketInitialized.current = false;
  //       setIsConnected(false);
  //       setSocketInstance(null);

  //       // Clear any pending reconnection timers
  //       if (reconnectTimerRef.current) {
  //         clearTimeout(reconnectTimerRef.current);
  //         reconnectTimerRef.current = null;
  //       }
  //     }
  //   };
  // }, [user]);


  // Handle reconnection logic
  useEffect(() => {
    if (!user || !socketInitialized.current || isConnected || reconnectTimerRef.current) {
      return;
    }

    const handleReconnection = () => {
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`⛔ Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
        return;
      }

      reconnectAttemptsRef.current += 1;
      const backoffTime = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 30000); // Exponential backoff with max of 30 seconds

      console.warn(`🔄 Socket disconnected. Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

      try {
        // First try to reconnect the existing socket
        if (socketInstance && !socketInstance.connected) {
          console.log("Reconnecting existing socket...");
          socketInstance.connect();
        } else {
          // If no valid socket instance, reinitialize
          console.log("Reinitializing socket connection...");
          cleanupSocket();
          socketInitialized.current = false;
          const newSocket = initializeSocket({ userId: user });
          setSocketInstance(newSocket);
          socketInitialized.current = true;
        }
      } catch (error) {
        console.error("Reconnection attempt failed:", error);

        // Schedule next reconnection attempt
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!isConnected) handleReconnection();
        }, backoffTime);
      }
    };

    // Schedule a reconnection attempt
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      handleReconnection();
    }, 5000); // Initial reconnection delay

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [user, isConnected, socketInstance]);

  // Provide the actual socket instance, not just the getter function
  const getSafeSocket = () => {
    try {
      return socketInstance || getSocket();
    } catch (error) {
      console.error("Error getting socket:", error);
      return null;
    }
  };

  const contextValue = {
    isConnected,
    lastConnectedAt,
    socket: getSafeSocket,
    userId: user
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};