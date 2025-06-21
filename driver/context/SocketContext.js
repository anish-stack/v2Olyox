import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { initializeSocket, fetchUserData, cleanupSocket } from "./socketService";
import { registerBackgroundSocketTask } from "./backgroundTasks/socketTask";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [isSocketReady, setSocketReady] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAndConnectSocket = async () => {
      try {
        const user = await fetchUserData();
        if (!user || !user._id) throw new Error("❌ Invalid user");

        setUserData(user);

        const newSocket = await initializeSocket({
          userType: "driver",
          userId: user._id,
        });

        if (newSocket) {
          socketRef.current = newSocket;
          setSocketReady(true);
        } else {
          throw new Error("❌ Socket not initialized");
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAndConnectSocket();
    registerBackgroundSocketTask(); // Register background reconnect task

    return () => {
      cleanupSocket();
      setSocketReady(false);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isSocketReady,
        loading,
        error,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("❌ useSocket must be used within SocketProvider");
  return context;
};
