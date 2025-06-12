import { useState, useEffect } from 'react';
import { findSettings } from '../utils/helpers';

const useSettings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getSettings = async () => {
            try {
                const response = await findSettings();
                setSettings(response);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        getSettings();
    }, []);

    return { settings, loading, error };
};

export default useSettings;