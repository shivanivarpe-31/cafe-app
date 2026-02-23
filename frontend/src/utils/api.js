/**
 * API Utility Functions
 * Handles all API communication with the backend
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

/**
 * Make API call with error handling
 */
export const apiCall = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;

    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    };

    // Get auth token from localStorage if available
    const token = localStorage.getItem('token');
    if (token) {
        defaultOptions.headers.Authorization = `Bearer ${token}`;
    }

    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, config);

        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Handle error responses
        if (!response.ok) {
            const error = new Error(data.message || `HTTP Error: ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
};

/**
 * Integration API methods
 */
export const integrationAPI = {
    // Get item mappings
    getMappings: async (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiCall(`/integration/mappings${queryParams ? '?' + queryParams : ''}`);
    },

    // Get mapping by ID
    getMapping: async (mappingId) => {
        return apiCall(`/integration/mappings/${mappingId}`);
    },

    // Create mapping
    createMapping: async (data) => {
        return apiCall('/integration/mappings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // Update mapping
    updateMapping: async (mappingId, data) => {
        return apiCall(`/integration/mappings/${mappingId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    // Delete mapping
    deleteMapping: async (mappingId) => {
        return apiCall(`/integration/mappings/${mappingId}`, {
            method: 'DELETE'
        });
    },

    // Bulk import mappings
    bulkImport: async (mappings) => {
        return apiCall('/integration/mappings/bulk-import', {
            method: 'POST',
            body: JSON.stringify({ mappings })
        });
    },

    // Export mappings
    exportMappings: async (platform = null) => {
        const url = platform
            ? `/integration/export?platform=${platform}`
            : '/integration/export';
        return apiCall(url);
    },

    // Get integration statistics
    getStats: async () => {
        return apiCall('/integration/stats');
    },

    // Sync menu preview
    syncPreview: async (platform) => {
        return apiCall(`/integration/sync/${platform}`, {
            method: 'POST'
        });
    },

    // Get platform orders
    getPlatformOrders: async (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiCall(`/orders${queryParams ? '?' + queryParams : ''}`);
    }
};

/**
 * Error handler utility
 */
export const handleAPIError = (error) => {
    if (error.status === 401) {
        // Redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
    }

    return error.data?.message || error.message || 'An error occurred';
};

/**
 * Retry logic for failed requests
 */
export const apiCallWithRetry = async (endpoint, options = {}, maxRetries = 3) => {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiCall(endpoint, options);
        } catch (error) {
            lastError = error;

            // Only retry on network errors or 5xx errors
            if (error.status && error.status < 500) {
                throw error;
            }

            // Exponential backoff
            if (attempt < maxRetries - 1) {
                await new Promise(resolve =>
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                );
            }
        }
    }

    throw lastError;
};

export default apiCall;
