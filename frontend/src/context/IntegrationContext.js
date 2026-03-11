/**
 * Integration Context
 * Manages global state for Swiggy & Zomato integration
 */

import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import useIntegration from '../hooks/useIntegration';

export const IntegrationContext = createContext();

export const IntegrationProvider = ({ children }) => {
    const [mappings, setMappings] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('ALL');

    // Destructure stable useCallback refs from the hook so they don't cause re-render loops
    const {
        loading,
        error,
        setError,
        getMappings,
        getStats,
        createMapping,
        deleteMapping,
        bulkImport,
        exportMappings,
        syncMenu
    } = useIntegration();

    const mountedRef = useRef(true);

    // Load mappings
    const loadMappings = useCallback(async (filters = {}) => {
        try {
            const data = await getMappings(filters);
            if (mountedRef.current) {
                setMappings(data.mappings || []);
            }
            return data;
        } catch (err) {
            console.error('Failed to load mappings:', err);
        }
    }, [getMappings]);

    // Load statistics
    const loadStats = useCallback(async () => {
        try {
            const data = await getStats();
            if (mountedRef.current) {
                setStats(data.stats);
            }
            return data;
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }, [getStats]);

    // Create mapping
    const handleCreateMapping = useCallback(async (mappingData) => {
        try {
            await createMapping(mappingData);
            await loadMappings({ platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined });
            await loadStats();
            return true;
        } catch (err) {
            console.error('Failed to create mapping:', err);
            throw err;
        }
    }, [createMapping, loadMappings, loadStats, selectedPlatform]);

    // Delete mapping
    const handleDeleteMapping = useCallback(async (mappingId) => {
        try {
            await deleteMapping(mappingId);
            await loadMappings({ platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined });
            await loadStats();
            return true;
        } catch (err) {
            console.error('Failed to delete mapping:', err);
            throw err;
        }
    }, [deleteMapping, loadMappings, loadStats, selectedPlatform]);

    // Bulk import
    const handleBulkImport = useCallback(async (importMappings) => {
        try {
            await bulkImport(importMappings);
            await loadMappings({ platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined });
            await loadStats();
            return true;
        } catch (err) {
            console.error('Failed to bulk import:', err);
            throw err;
        }
    }, [bulkImport, loadMappings, loadStats, selectedPlatform]);

    // Initial load — only fetch when authenticated
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            loadMappings();
            loadStats();
        }
        return () => {
            mountedRef.current = false;
        };
    }, [loadMappings, loadStats]);

    const value = {
        // State
        mappings,
        stats,
        selectedPlatform,
        loading,
        error,

        // Setters
        setSelectedPlatform,
        setError,

        // Actions
        loadMappings,
        loadStats,
        handleCreateMapping,
        handleDeleteMapping,
        handleBulkImport,
        exportMappings,
        syncMenu
    };

    return (
        <IntegrationContext.Provider value={value}>
            {children}
        </IntegrationContext.Provider>
    );
};

export default IntegrationContext;
