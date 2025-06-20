import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import * as SecureStore from 'expo-secure-store'; // assuming you're using expo-secure-store

const API_URL_APP = `http://192.168.1.6:3100`;

const useGetCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCoupons = useCallback(async (userId) => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL_APP}/api/v1/admin/personal-coupon/${userId}`
      );
      const couponData = response.data?.data || [];
      setCoupons(couponData);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserAndCoupons = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab");
      if (!token) throw new Error("Authentication token not found");

      const response = await axios.get(
        `${API_URL_APP}/api/v1/rider/user-details`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const userId = response?.data?.partner?._id;
      if (userId) {
        fetchCoupons(userId);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  }, [fetchCoupons]);

  useEffect(() => {
    fetchUserAndCoupons();
  }, [fetchUserAndCoupons]);

  return {
    coupons,
    loading,
    refresh: fetchUserAndCoupons, // use this to manually re-fetch
  };
};

export default useGetCoupons;
