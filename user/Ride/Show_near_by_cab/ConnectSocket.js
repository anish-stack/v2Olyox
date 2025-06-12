
import { useEffect, useState } from "react"
import { initializeSocket } from "../../services/socketService";
import { find_me } from "../../utils/helpers";


export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const setupSocket = async () => {
            try {
                const user = await find_me();
                const userId = user?.user?._id;
                if (userId) {
                    const newSocket = await initializeSocket({ userId });
                    setSocket(newSocket);
                    setIsConnected(newSocket.connected);

                    newSocket.on('connect', () => setIsConnected(true));
                    newSocket.on('disconnect', () => setIsConnected(false));
                }
            } catch (error) {
                console.error("Error initializing socket:", error);
            }
        };

        setupSocket();

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [socket]);

    return { socket, isConnected }
}

