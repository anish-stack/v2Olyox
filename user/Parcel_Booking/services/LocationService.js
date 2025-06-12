import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'https://api.srtutorsbureau.com',
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle common error cases
    if (error.response?.status === 429) {
      // Rate limiting
      return Promise.reject(new Error('Too many requests. Please try again later.'));
    }
    return Promise.reject(error);
  }
);

export const LocationService = {
  getCurrentLocation: async (coords) => {
    try {
      const response = await api.post('/Fetch-Current-Location', {
        lat: coords.latitude,
        lng: coords.longitude,
      });
      return response.data?.address?.completeAddress;
    } catch (error) {
      throw new Error('Failed to fetch current location');
    }
  },

  searchLocations: async (query) => {
    console.log("query",query)
    try {
      const response = await api.get('/autocomplete', {
        params: { input: query }
      });
  
      return response || [];
    } catch (error) {
      throw new Error('Failed to fetch location suggestions');
    }
  },

  getCoordinates: async (address) => {
    try {
      const response = await api.get(`/geocode?address=${encodeURIComponent(address)}`);
      return {
        latitude: response.latitude,
        longitude: response.longitude,
      };
    } catch (error) {
      throw new Error('Failed to get coordinates for address');
    }
  }
};