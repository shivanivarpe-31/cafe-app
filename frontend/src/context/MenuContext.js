import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const MenuContext = createContext();

export const useMenu = () => {
    const context = useContext(MenuContext);
    if (!context) throw new Error('useMenu must be inside MenuProvider');
    return context;
};

export const MenuProvider = ({ children }) => {
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    // Memoize api instance so it doesn't change on every render
    const api = useMemo(() => {
        const instance = axios.create({
            baseURL: process.env.REACT_APP_API_URL || '/api',
        });

        instance.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        return instance;
    }, []);

    const abortControllerRef = useRef(null);

    const fetchMenu = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        setLoading(true);
        try {
            const res = await api.get('/menu/items', {
                signal: abortControllerRef.current.signal,
            });
            setMenuItems(res.data.data || res.data || []);
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') return;
            console.error('Failed to fetch menu:', err);
            setMenuItems([]);
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        if (!user) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setMenuItems([]);
            setLoading(false);
            return;
        }

        fetchMenu();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [user, fetchMenu]);

    const addItem = useCallback(async (item) => {
        const res = await api.post('/menu/items', item);
        setMenuItems((prev) => [...prev, res.data]);
        return res.data;
    }, [api]);

    const updateItem = useCallback(async (id, data) => {
        const res = await api.put(`/menu/items/${id}`, data);
        setMenuItems((prev) => prev.map((m) => (m.id === id ? res.data : m)));
        return res.data;
    }, [api]);

    const deleteItem = useCallback(async (id) => {
        await api.delete(`/menu/items/${id}`);
        setMenuItems((prev) => prev.filter((m) => m.id !== id));
    }, [api]);

    return (
        <MenuContext.Provider
            value={{
                menuItems,
                setMenuItems,
                loading,
                fetchMenu,
                addItem,
                updateItem,
                deleteItem,
            }}
        >
            {children}
        </MenuContext.Provider>
    );
};