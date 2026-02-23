import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be inside AuthProvider');
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Parse duration string (e.g. '8h', '30m', '1d') to milliseconds
    const parseDuration = (str) => {
        if (!str) return 8 * 60 * 60 * 1000; // default 8h
        const match = str.match(/^(\d+)([smhd])$/);
        if (!match) return 8 * 60 * 60 * 1000;
        const val = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        return val * (multipliers[unit] || 3600000);
    };

    // Auto-refresh timer ref
    const refreshTimerRef = React.useRef(null);

    const scheduleTokenRefresh = React.useCallback((expiresIn) => {
        // Clear any existing timer
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

        const expiryMs = parseDuration(expiresIn);
        // Refresh at 75% of the token's lifetime
        const refreshAt = Math.max(expiryMs * 0.75, 60000); // at least 1 min

        refreshTimerRef.current = setTimeout(async () => {
            try {
                const res = await axios.post('/api/auth/refresh');
                if (res.data.token) {
                    localStorage.setItem('token', res.data.token);
                    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
                    // Schedule next refresh
                    scheduleTokenRefresh(res.data.expiresIn);
                }
            } catch {
                // Refresh failed — token expired or user deactivated; interceptor will handle 401
            }
        }, refreshAt);
    }, []);

    useEffect(() => {
        let mounted = true;

        // Attach request interceptor once on mount
        const reqInterceptor = axios.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                if (token) config.headers.Authorization = `Bearer ${token}`;
                return config;
            },
            (error) => Promise.reject(error),
        );

        // Attach response interceptor to handle auth failures (401)
        const resInterceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    // Token invalid/expired — remove local token and user
                    localStorage.removeItem('token');
                    delete axios.defaults.headers.common['Authorization'];
                    if (mounted) setUser(null);
                }
                return Promise.reject(error);
            }
        );

        // If a token already exists, set default header and try to fetch the current user
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Populate user from backend
            (async () => {
                try {
                    const res = await axios.get('/api/auth/me');
                    // backend returns { user: req.user }
                    if (mounted && res?.data?.user) {
                        setUser(res.data.user);
                        // Start auto-refresh cycle for existing token
                        scheduleTokenRefresh(null);
                    }
                } catch (err) {
                    // If /me failed (401 etc), interceptor already cleared token/user.
                    console.error('Failed to populate user from token:', err?.response?.data || err.message);
                    if (mounted) setUser(null);
                } finally {
                    if (mounted) setLoading(false);
                }
            })();
        } else {
            // No token — nothing to populate
            setLoading(false);
        }

        // Clean up interceptors and refresh timer on unmount
        return () => {
            mounted = false;
            axios.interceptors.request.eject(reqInterceptor);
            axios.interceptors.response.eject(resInterceptor);
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, [scheduleTokenRefresh]);

    const login = async (email, password) => {
        const res = await axios.post('/api/auth/login', { email, password });
        const token = res.data.token;
        if (token) {
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Schedule auto-refresh based on server-provided expiry
            scheduleTokenRefresh(res.data.expiresIn);
        }
        // set user from response (backend returns { token, user })
        if (res.data.user) setUser(res.data.user);
        return res.data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        setUser(null);
    };

    // Role helper methods
    const hasRole = (role) => {
        return user?.role === role;
    };

    const hasAnyRole = (roles) => {
        return roles.includes(user?.role);
    };

    const isAdmin = () => hasRole('ADMIN');
    const isManager = () => hasRole('MANAGER');
    const isChef = () => hasRole('CHEF');
    const isAdminOrManager = () => hasAnyRole(['ADMIN', 'MANAGER']);

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            loading,
            hasRole,
            hasAnyRole,
            isAdmin,
            isManager,
            isChef,
            isAdminOrManager
        }}>
            {children}
        </AuthContext.Provider>
    );
};