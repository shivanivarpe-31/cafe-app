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

    // Sync menu to platform (actually pushes to Zomato)
    const syncMenu = useCallback(async (platform) => {
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

    // Preview menu sync payload (dry run)
    const previewMenuSync = useCallback(async (platform) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/sync/${platform}/preview`);
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch current menu from platform
    const fetchPlatformMenu = useCallback(async (platform) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/menu/${platform}`);
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Sync all stock statuses to platform
    const syncStock = useCallback(async (platform) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/stock/${platform}`, {
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

    // Toggle stock for a single item
    const toggleItemStock = useCallback(async (platform, menuItemId, inStock) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/stock/${platform}/${menuItemId}`, {
                method: 'PUT',
                body: JSON.stringify({ inStock })
            });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Platform Configuration ──

    // Get all platform configs
    const getPlatformConfigs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall('/integration/config');
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Get single platform config
    const getPlatformConfig = useCallback(async (platform) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/config/${platform}`);
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Update platform config
    const updatePlatformConfig = useCallback(async (platform, configData) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/config/${platform}`, {
                method: 'PUT',
                body: JSON.stringify(configData)
            });
            return response;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Test platform connection
    const testPlatformConnection = useCallback(async (platform) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(`/integration/config/${platform}/test`, {
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

    // ── Outlet Management ──

    const getOutletDeliveryStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/delivery-status');
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const updateOutletDeliveryStatus = useCallback(async (enabled, reason) => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/delivery-status', {
                method: 'PUT', body: JSON.stringify({ enabled, reason })
            });
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const updateDeliveryCharge = useCallback(async (charges) => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/delivery-charge', {
                method: 'PUT', body: JSON.stringify({ charges })
            });
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const getOutletDeliveryTime = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/delivery-time');
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const updateSurgeTime = useCallback(async (surgeTime, remove = false) => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/surge-time', {
                method: 'POST', body: JSON.stringify({ surgeTime, remove })
            });
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const getZomatoDeliveryTimings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/zomato-timings');
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const updateZomatoDeliveryTimings = useCallback(async (timings) => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/zomato-timings', {
                method: 'PUT', body: JSON.stringify({ timings })
            });
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const getSelfDeliveryTimings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/self-delivery-timings');
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const updateSelfDeliveryTimings = useCallback(async (timings) => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/self-delivery-timings', {
                method: 'PUT', body: JSON.stringify({ timings })
            });
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const getLogisticsStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/logistics-status');
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    }, []);

    const updateSelfDeliveryServiceability = useCallback(async (enabled, reason) => {
        setLoading(true);
        setError(null);
        try {
            return await apiCall('/integration/outlet/self-delivery-serviceability', {
                method: 'PUT', body: JSON.stringify({ enabled, reason })
            });
        } catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
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
        syncMenu,
        previewMenuSync,
        fetchPlatformMenu,
        syncStock,
        toggleItemStock,
        getPlatformConfigs,
        getPlatformConfig,
        updatePlatformConfig,
        testPlatformConnection,
        // Outlet Management
        getOutletDeliveryStatus,
        updateOutletDeliveryStatus,
        updateDeliveryCharge,
        getOutletDeliveryTime,
        updateSurgeTime,
        getZomatoDeliveryTimings,
        updateZomatoDeliveryTimings,
        getSelfDeliveryTimings,
        updateSelfDeliveryTimings,
        getLogisticsStatus,
        updateSelfDeliveryServiceability
    };
};

export default useIntegration;
