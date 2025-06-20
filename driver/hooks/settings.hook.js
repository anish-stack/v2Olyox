import { useEffect, useState } from 'react';
import axios from 'axios';

const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('http://192.168.1.6:3100/api/v1/admin/get_Setting');
        console.log(response.data)
        setSettings(response.data); // Assuming API wraps in { success, data }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading, error };
};

export default useSettings;
