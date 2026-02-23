/**
 * useIntegration Hook
 * Manages all integration-related API calls for Swiggy & Zomato
 */

import { useState, useCallback } from 'react';
import { apiCall } from '../utils/api';

export const useIntegration = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get all menu item mappings
    const getMappings = useCallback(async (filters = {}) => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await apiCall(`/integration/mappings${queryParams ? '?' + queryParams : ''}`);
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Get mappings for specific menu item
    const getMenuItemMappings = useCallback(async (menuItemId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/mappings/${menuItemId}`);
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Create or update mapping
    const createMapping = useCallback(async (mappingData) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall('/integration/mappings', {
                method: 'POST',
                body: JSON.stringify(mappingData)
            });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Delete mapping
    const deleteMapping = useCallback(async (mappingId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/mappings/${mappingId}`, {
                method: 'DELETE'
            });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Bulk import mappings
    const bulkImport = useCallback(async (mappings) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall('/integration/mappings/bulk-import', {
                method: 'POST',
                body: JSON.stringify({ mappings })
            });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Export mappings
    const exportMappings = useCallback(async (platform = null) => {
        setLoading(true);
        setError(null);
        try {
            const url = platform
                ? `/integration/export?platform=${platform}`
                : '/integration/export';
            const response = await apiCall(url);
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Get integration statistics
    const getStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall('/integration/stats');
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Sync menu preview
    const syncPreview = useCallback(async (platform) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/sync/${platform}`, {
                method: 'POST'
            });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        setError,
        getMappings,
        getMenuItemMappings,
        createMapping,
        deleteMapping,
        bulkImport,
        exportMappings,
        getStats,
        syncPreview
    };
};

export default useIntegration;
