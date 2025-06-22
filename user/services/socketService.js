import { io } from "socket.io-client";

const SOCKET_URL = "https://appapi.olyox.com"; // Update this with your backend IP/host
let socket = null;

export const initializeSocket = ({ userType = "user", userId }) => {
  if (socket) {
    if (!socket.connected) {
      console.log("🔄 Socket exists but was disconnected. Reconnecting...");
      socket.connect();
    } else {
      console.log("✅ Socket already connected.");
    }
    return socket;
  }

  console.log("🚀 Initializing new Socket.IO client...");

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  // Store user data in socket instance
  socket.userType = userType;
  socket.userId = userId;

  /** Connection Success */
  socket.on("connect", () => {
    console.log("🟢 Socket connected:", socket.id);
    socket.emit("user_connect", { userType, userId });
  });

  /** Disconnection */
  socket.on("disconnect", (reason) => {
    console.warn("🔴 Socket disconnected:", reason);
  });

  /** Connection Errors */
  // socket.on("connect_error", (err) => {
  //   console.error("⚠️ Connection error:", err.message);
  // });

  /** Reconnection Events */
  socket.on("reconnect_attempt", (attempt) => {
    console.log(`🔁 Reconnection attempt #${attempt}`);
  });

  socket.on("reconnect", (attempt) => {
    console.log(`✅ Successfully reconnected after ${attempt} attempts`);
    socket.emit("user_connect", { userType, userId }); // Re-auth if needed
  });

  socket.on("reconnect_error", (err) => {
    console.error("❌ Reconnection error:", err.message);
  });

  socket.on("reconnect_failed", () => {
    console.error("🚫 All reconnection attempts failed");
  });

  /** Custom Ping-Pong */
  socket.on("pong-custom-user", (data) => {
    console.log("📡 Received pong from server:", data);
  });

  // Start custom ping interval
  startPing();

  return socket;
};

/**
 * Start emitting ping every 20 seconds
 */
const startPing = () => {
  setInterval(() => {
    if (socket && socket.connected) {
      socket.emit("ping-custom-user", { timestamp: Date.now() });
    }
  }, 20000);
};

/** Get current socket instance */
export const getSocket = () => {
  if (!socket) {
    throw new Error("⚠️ Socket is not initialized. Call initializeSocket() first.");
  }
  return socket;
};

/** Disconnect and cleanup */
export const cleanupSocket = () => {
  if (socket) {
    console.log("🛑 Cleaning up socket connection...");
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
};

/** Check socket connection status */
export const isSocketConnected = () => {
  return socket && socket.connected;
};
