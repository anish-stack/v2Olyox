import NetInfo from '@react-native-community/netinfo';
import io from "socket.io-client";
import axios from "axios";
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL = "http://192.168.1.6:3100";
let socket = null;
let pingIntervalRef = null;
let networkStateRef = null;
let lastNetworkState =null;
let reconnectAttempts = 0;
let lastDisconnectTime = null;
let networkChangeTimeout = null;
// Add variable declaration

// Enhanced logging utility
const log = {
    info: (message, data = {}) => console.log(`🔵 [SOCKET] ${message}`, Object.keys(data).length > 0 ? data : ''),
    success: (message, data = {}) => console.log(`✅ [SOCKET] ${message}`, Object.keys(data).length > 0 ? data : ''),
    warning: (message, data = {}) => console.warn(`⚠️ [SOCKET] ${message}`, Object.keys(data).length > 0 ? data : ''),
    error: (message, data = {}) => console.error(`❌ [SOCKET] ${message}`, Object.keys(data).length > 0 ? data : ''),
    network: (message, data = {}) => console.log(`🌐 [NETWORK] ${message}`, Object.keys(data).length > 0 ? data : ''),
    debug: (message, data = {}) => console.log(`🐛 [DEBUG] ${message}`, Object.keys(data).length > 0 ? data : '')
};


const initializeNetworkMonitoring = () => {
    if (networkStateRef) {
        log.debug("Network monitoring already initialized");
        return;
    }

    log.info("Initializing network monitoring...");
    
    networkStateRef = NetInfo.addEventListener(state => {
        // Debounce rapid network state changes
        if (networkChangeTimeout) {
            clearTimeout(networkChangeTimeout);
        }
        
        networkChangeTimeout = setTimeout(() => {
            const currentTime = new Date().toLocaleTimeString();
            
            // Only log significant network changes
            const isSignificantChange = !lastNetworkState || 
                lastNetworkState.isConnected !== state.isConnected ||
                lastNetworkState.isInternetReachable !== state.isInternetReachable ||
                lastNetworkState.type !== state.type;
            
            if (isSignificantChange) {
                log.network(`Network state changed at ${currentTime}`, {
                    isConnected: state.isConnected,
                    isInternetReachable: state.isInternetReachable,
                    type: state.type,
                    ssid: state.details?.ssid || 'N/A',
                    strength: state.details?.strength || 'N/A'
                });

                // Detect network changes during peak disconnect times
                if (lastDisconnectTime && !state.isConnected) {
                    const timeSinceDisconnect = Date.now() - lastDisconnectTime;
                    if (timeSinceDisconnect < 30000) { // Within 30 seconds of disconnect
                        log.warning("Network loss detected shortly after socket disconnect", {
                            timeSinceDisconnect: `${timeSinceDisconnect}ms`
                        });
                    }
                }

                // Check for network connectivity issues
                if (!state.isConnected) {
                    log.error("Device lost network connection", {
                        previousType: lastNetworkState?.type || 'unknown',
                        socketConnected: socket?.connected || false
                    });
                } else if (state.isConnected && !state.isInternetReachable) {
                    log.warning("Network connected but internet not reachable", {
                        networkType: state.type
                    });
                } else if (state.isConnected && state.isInternetReachable && 
                          (!lastNetworkState?.isConnected || !lastNetworkState?.isInternetReachable)) {
                    log.success("Network and internet connection restored", {
                        networkType: state.type
                    });
                    
                    // Attempt to reconnect socket if it's disconnected
                    if (socket && !socket.connected) {
                        log.info("Attempting socket reconnection after network restoration");
                        setTimeout(() => socket.connect(), 1000);
                    }
                }

                lastNetworkState = { 
                    isConnected: state.isConnected,
                    isInternetReachable: state.isInternetReachable,
                    type: state.type
                };
            }
        }, 500); // 500ms debounce
    });
};

// Enhanced ping/heartbeat with transport monitoring
const startHeartbeat = () => {
    if (pingIntervalRef) {
        log.debug("Heartbeat already running");
        return;
    }

    log.info("Starting socket heartbeat...");
    missedPongs = 0; // Reset missed pong counter
    
    pingIntervalRef = setInterval(async () => {
        if (socket && socket.connected) {
            const pingTime = Date.now();
            lastPingTime = pingTime;
            
            try {
                const networkState = await NetInfo.fetch();
                
                // Check for transport health
                const transport = socket.io.engine.transport;
                log.debug("Transport status during heartbeat", {
                    transportName: transport.name,
                    transportReadyState: transport.readyState,
                    engineState: socket.io.engine.readyState,
                    missedPongs: missedPongs
                });
                
                if (!networkState.isConnected || !networkState.isInternetReachable) {
                    log.warning("Network issues detected during heartbeat", {
                        isConnected: networkState.isConnected,
                        isInternetReachable: networkState.isInternetReachable,
                        type: networkState.type,
                        transportState: transport.readyState
                    });
                }

                // Check for too many missed pongs
                if (missedPongs > 3) {
                    log.error("Too many missed pongs detected, transport may be stale", {
                        missedPongs,
                        lastPingTime,
                        transportName: transport.name
                    });
                }

                socket.emit("ping-custom", { 
                    time: pingTime,
                    transportInfo: {
                        name: transport.name,
                        readyState: transport.readyState
                    },
                    networkState: {
                        isConnected: networkState.isConnected,
                        isInternetReachable: networkState.isInternetReachable,
                        type: networkState.type
                    }
                });
                
                log.debug("Heartbeat ping sent", { 
                    pingTime, 
                    networkType: networkState.type,
                    transport: transport.name
                });
                
                // Set timeout to detect missed pong
                setTimeout(() => {
                    if (lastPingTime === pingTime) {
                        missedPongs++;
                        log.warning("Pong not received within timeout", {
                            pingTime,
                            missedPongs,
                            transport: transport.name
                        });
                    }
                }, 5000); // 5 second pong timeout
                
            } catch (error) {
                log.error("Error during heartbeat network check", { error: error.message });
            }
        } else {
            log.warning("Socket not connected during heartbeat attempt", {
                socketExists: !!socket,
                socketConnected: socket?.connected || false
            });
        }
    }, 20000); // Every 20 seconds
};

// Stop heartbeat
const stopHeartbeat = () => {
    if (pingIntervalRef) {
        clearInterval(pingIntervalRef);
        pingIntervalRef = null;
        log.info("Heartbeat stopped");
    }
};

// Fetch user details with enhanced logging
export const fetchUserData = async () => {
    log.info("Fetching user data...");
    
    try {
        const token = await SecureStore.getItemAsync("auth_token_cab");
        
        if (!token) {
            log.error("No auth token found in secure store");
            throw new Error("No auth token found");
        }
        
        log.debug("Auth token retrieved successfully");

        const response = await axios.get(
            "http://192.168.1.6:3100/api/v1/rider/user-details",
            {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000 // 10 second timeout
            }
        );
        
 
        return response.data.partner;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            log.error("Request timeout while fetching user data");
        } else if (error.response) {
            log.error("Server error while fetching user data", {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        } else if (error.request) {
            log.error("Network error while fetching user data", {
                message: error.message,
                code: error.code
            });
        } else {
            log.error("Unknown error while fetching user data", error.message);
        }
        throw error;
    }
};

// Enhanced socket initialization
export const initializeSocket = async ({ userType = "driver", userId }) => {
    log.info("Initializing socket connection...", { userType, userId });
    
    if (!userId) {
        log.error("User ID is required to initialize socket");
        return null;
    }

    // Initialize network monitoring
    initializeNetworkMonitoring();

    // Check network state before connecting
    try {
        const networkState = await NetInfo.fetch();
        // log.network("Current network state", {
        //     isConnected: networkState.isConnected,
        //     isInternetReachable: networkState.isInternetReachable,
        //     type: networkState.type,
        //     details: networkState.details
        // });

        if (!networkState.isConnected) {
            log.error("Cannot initialize socket - no network connection");
            throw new Error("No network connection available");
        }

        if (!networkState.isInternetReachable) {
            log.warning("Network connected but internet not reachable - attempting socket connection anyway");
        }
    } catch (error) {
        log.error("Error checking network state", error);
    }

    if (!socket) {
        log.info("Creating new socket instance...");
        
        socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
            timeout: 20000,
            autoConnect: true,
            forceNew: true
        });

        socket.userType = userType;
        socket.userId = userId;

        return new Promise((resolve, reject) => {
            // Connection successful
            socket.on("connect", async () => {
                const connectionTime = new Date().toLocaleTimeString();
                connectionStartTime = Date.now();
                reconnectAttempts = 0;
                missedPongs = 0;
                
                log.success(`Socket connected at ${connectionTime}`, {
                    socketId: socket.id,
                    userType,
                    userId,
                    transport: socket.io.engine.transport.name,
                    engineState: socket.io.engine.readyState
                });

                // Check network state on connection
                try {
                    const networkState = await NetInfo.fetch();
                    log.network("Network state on socket connection", {
                        isConnected: networkState.isConnected,
                        isInternetReachable: networkState.isInternetReachable,
                        type: networkState.type
                    });
                } catch (error) {
                    log.error("Error checking network on connection", { error: error.message });
                }

                socket.emit("driver_connect", { userType, userId });
                log.debug("Emitted driver_connect event", { userType, userId });

                startHeartbeat();
                resolve(socket);
            });

            // Connection error
            socket.on("connect_error", async (error) => {
                const errorTime = new Date().toLocaleTimeString();
                reconnectAttempts++;
                
                // log.error(`Connection error at ${errorTime} (attempt ${reconnectAttempts})`, {
                //     message: error.message,
                //     description: error.description,
                //     type: error.type,
                //     transport: error.transport
                // });

                // Check network state on connection error
                try {
                    const networkState = await NetInfo.fetch();
                    // log.network("Network state on connection error", {
                    //     isConnected: networkState.isConnected,
                    //     isInternetReachable: networkState.isInternetReachable,
                    //     type: networkState.type
                    // });
                } catch (netError) {
                    log.error("Error checking network during connection error", { error: netError.message });
                }

                reject(error);
            });

            // Disconnect event with detailed analysis
            socket.on("disconnect", async (reason, details) => {
                const disconnectTime = new Date().toLocaleTimeString();
                const connectionDuration = connectionStartTime ? Date.now() - connectionStartTime : 'unknown';
                lastDisconnectTime = Date.now();
                
                log.error(`Socket disconnected at ${disconnectTime}`, {
                    reason,
                    details: details || 'no details',
                    socketId: socket.id,
                    connectionDuration: typeof connectionDuration === 'number' ? `${connectionDuration}ms` : connectionDuration,
                    transport: socket.io.engine?.transport?.name || 'unknown',
                    engineState: socket.io.engine?.readyState || 'unknown'
                });

                // Analyze disconnect reason
                if (reason === 'transport close') {
                    log.error("TRANSPORT CLOSE DETECTED - Connection closed unexpectedly", {
                        possibleCauses: [
                            'Network connectivity lost',
                            'Server terminated connection',
                            'Transport timeout',
                            'App backgrounded (mobile)',
                            'Device sleep mode'
                        ],
                        lastPingTime: lastPingTime ? new Date(lastPingTime).toLocaleTimeString() : 'none',
                        missedPongs
                    });
                } else if (reason === 'ping timeout') {
                    log.error("PING TIMEOUT - Server didn't receive ping in time", {
                        lastPingTime: lastPingTime ? new Date(lastPingTime).toLocaleTimeString() : 'none',
                        missedPongs
                    });
                } else if (reason === 'transport error') {
                    log.error("TRANSPORT ERROR - Underlying transport error", {
                        details: details,
                        transport: socket.io.engine?.transport?.name
                    });
                }

                // Check network state on disconnect
                try {
                    const networkState = await NetInfo.fetch();
                    log.network("Network state on disconnect", {
                        isConnected: networkState.isConnected,
                        isInternetReachable: networkState.isInternetReachable,
                        type: networkState.type,
                        disconnectReason: reason
                    });

                    // Correlate network state with disconnect reason
                    if (!networkState.isConnected && reason === 'transport close') {
                        log.warning("Disconnect confirmed: Network connectivity lost");
                    } else if (networkState.isConnected && reason === 'transport close') {
                        log.warning("Unexpected disconnect: Network available but transport closed", {
                            networkType: networkState.type,
                            possibleCause: 'Server-side issue or mobile app backgrounding'
                        });
                    }
                } catch (error) {
                    log.error("Error checking network on disconnect", { error: error.message });
                }

                stopHeartbeat();
            });

            // Reconnection attempt
            socket.on("reconnect_attempt", (attempt) => {
                log.info(`Reconnection attempt #${attempt}`, {
                    totalAttempts: attempt,
                    timeSinceDisconnect: lastDisconnectTime ? `${Date.now() - lastDisconnectTime}ms` : 'unknown'
                });
            });

            // Successful reconnection
            socket.on("reconnect", async (attempt) => {
                const reconnectTime = new Date().toLocaleTimeString();
                connectionStartTime = Date.now(); // Reset connection start time
                
                log.success(`Reconnected successfully at ${reconnectTime}`, {
                    attemptsRequired: attempt,
                    socketId: socket.id,
                    transport: socket.io.engine.transport.name
                });

                // Check network state on reconnection
                try {
                    const networkState = await NetInfo.fetch();
                    log.network("Network state on reconnection", {
                        isConnected: networkState.isConnected,
                        isInternetReachable: networkState.isInternetReachable,
                        type: networkState.type
                    });
                } catch (error) {
                    log.error("Error checking network on reconnection", { error: error.message });
                }

                socket.emit("driver_connect", { userType, userId });
                log.debug("Re-emitted driver_connect after reconnection");
                
                startHeartbeat();
            });

            // Failed reconnection
            socket.on("reconnect_failed", async () => {
                log.error("All reconnection attempts failed");
                
                try {
                    const networkState = await NetInfo.fetch();
                    log.network("Network state after reconnection failure", {
                        isConnected: networkState.isConnected,
                        isInternetReachable: networkState.isInternetReachable,
                        type: networkState.type
                    });
                } catch (error) {
                    log.error("Error checking network after reconnection failure", { error: error.message });
                }
            });

            // Custom pong response with missed pong tracking
            socket.on("pong-custom", (data) => {
                try {
                    const sentTime = data.echo?.time || data.time;
                    const roundTripTime = sentTime ? Date.now() - sentTime : 'unknown';
                    
                    // Reset missed pongs on successful pong
                    if (sentTime === lastPingTime) {
                        missedPongs = Math.max(0, missedPongs - 1);
                    }
                    
                    log.debug("Pong received from server", {
                        roundTripTime: typeof roundTripTime === 'number' ? `${roundTripTime}ms` : roundTripTime,
                        authenticated: data.authenticated,
                        userId: data.userId,
                        missedPongs
                    });
                } catch (error) {
                    log.error("Error processing pong response", { error: error.message });
                }
            });

            // Transport monitoring events
            socket.io.on("upgrade", () => {
                transportUpgradeAttempts++;
                log.info("Socket transport upgraded", { 
                    transport: socket.io.engine.transport.name,
                    upgradeAttempts: transportUpgradeAttempts
                });
            });

            socket.io.on("upgradeError", (error) => {
                log.error("Socket transport upgrade error", { 
                    error: error.message,
                    currentTransport: socket.io.engine.transport.name
                });
            });

            // Engine-level events for deeper transport monitoring
            socket.io.engine.on("packet", (type, data) => {
                if (type === 'ping' || type === 'pong') {
                    log.debug(`Engine ${type} packet`, { 
                        transport: socket.io.engine.transport.name,
                        readyState: socket.io.engine.transport.readyState
                    });
                }
            });

            socket.io.engine.on("packetCreate", (packet) => {
                if (packet.type === 'ping') {
                    log.debug("Ping packet created", {
                        transport: socket.io.engine.transport.name
                    });
                }
            });

            // Transport close event
            socket.io.engine.transport.on('close', (reason) => {
                log.error("TRANSPORT CLOSE EVENT DETECTED", {
                    reason: reason || 'no reason provided',
                    transport: socket.io.engine.transport.name,
                    readyState: socket.io.engine.transport.readyState,
                    timestamp: new Date().toISOString()
                });
            });

            // Transport error event
            // socket.io.engine.transport.on('error', (error) => {
            //     log.error("TRANSPORT ERROR EVENT", {
            //         error: error.message || error,
            //         transport: socket.io.engine.transport.name,
            //         readyState: socket.io.engine.transport.readyState,
            //         timestamp: new Date().toISOString()
            //     });
            // });
        });
    } else {
        log.info("Socket already exists, returning existing instance", {
            connected: socket.connected,
            socketId: socket.id
        });
        return socket;
    }
};

// Get socket instance with validation
export const getSocket = () => {
    if (!socket) {
        log.error("Socket is not initialized. Call initializeSocket() first.");
        throw new Error("Socket is not initialized. Call initializeSocket() first.");
    }
    
    log.debug("Getting socket instance", {
        connected: socket.connected,
        socketId: socket.id
    });
    
    return socket;
};

// Enhanced cleanup with proper logging
export const cleanupSocket = () => {
    log.info("Cleaning up socket connection...");
    
    if (socket) {
        log.debug("Disconnecting socket", { 
            socketId: socket.id, 
            connected: socket.connected 
        });
        socket.disconnect();
        socket = null;
        log.success("Socket disconnected and cleared");
    } else {
        log.debug("No socket to cleanup");
    }

    stopHeartbeat();

    if (networkStateRef) {
        log.debug("Removing network listener");
        networkStateRef();
        networkStateRef = null;
    }

    // Clear network change timeout
    if (networkChangeTimeout) {
        clearTimeout(networkChangeTimeout);
        networkChangeTimeout = null;
    }

    // Reset state variables
    reconnectAttempts = 0;
    lastDisconnectTime = null;
    lastNetworkState = null;
    
    log.success("Socket cleanup completed");
};

// Additional utility functions for debugging
export const getSocketStatus = () => {
    const status = {
        exists: !!socket,
        connected: socket?.connected || false,
        socketId: socket?.id || null,
        userType: socket?.userType || null,
        userId: socket?.userId || null,
        heartbeatActive: !!pingIntervalRef,
        networkMonitoringActive: !!networkStateRef,
        lastDisconnectTime,
        reconnectAttempts
    };
    
    log.debug("Socket status requested", status);
    return status;
};

export const forceReconnect = async () => {
    log.info("Forcing socket reconnection...");
    
    if (socket) {
        if (socket.connected) {
            log.debug("Disconnecting existing socket before reconnection");
            socket.disconnect();
        }
        
        setTimeout(() => {
            log.debug("Attempting to reconnect socket");
            socket.connect();
        }, 1000);
    } else {
        log.warning("No socket to reconnect");
    }
};