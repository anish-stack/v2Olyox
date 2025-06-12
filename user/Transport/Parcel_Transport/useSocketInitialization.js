import { useEffect } from 'react';
import { find_me } from '../../utils/helpers';
import { initializeSocket } from '../../services/socketService';

export const useSocketInitialization = (socket, onInitialized) => {
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 2000;

    const initialize = async () => {
      try {
        console.log('🔵 Fetching user data...');
        const data = await find_me();
        console.log('🟢 User data received:', data?.user?._id);

        if (data?.user?._id) {
          console.log('🔵 Initializing socket...');
          await initializeSocket({ userId: data.user._id });
          console.log('🟢 Socket initialized successfully');
          onInitialized?.();
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`🟡 Retrying fetch user data... Attempt ${retryCount}`);
          setTimeout(initialize, retryDelay);
        } else {
          console.error('🔴 Max retries reached. User ID is still missing.');
        }
      } catch (error) {
        console.error('🔴 Error initializing socket:', error);
      }
    };

    if (!socket) {
      initialize();
    }
  }, [socket, onInitialized]);
};