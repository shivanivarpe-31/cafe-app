import { useEffect, useRef, useCallback } from 'react';

/**
 * Smart polling hook that respects page visibility and user activity
 *
 * Features:
 * - Only polls when page is visible
 * - Stops polling when user switches tabs
 * - Reduces polling frequency when user is inactive
 * - Automatically resumes when user returns
 * - Stable across renders — callers don't need to memoize the callback
 *
 * @param {Function} callback - Function to call on each poll
 * @param {number} activeInterval - Polling interval when user is active (ms)
 * @param {number} inactiveInterval - Polling interval when user is inactive (ms)
 * @param {number} inactiveThreshold - Time before considering user inactive (ms)
 */
export const useSmartPolling = (
  callback,
  activeInterval = 5000,       // 5 seconds
  inactiveInterval = 30000,    // 30 seconds
  inactiveThreshold = 60000    // 1 minute
) => {
  const intervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isActiveRef = useRef(true);
  const callbackRef = useRef(callback);

  // Always keep the ref pointing to the latest callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Stable function to invoke the latest callback
  const invokeCallback = useCallback(() => {
    callbackRef.current();
  }, []);

  // Helper to start an interval at a given rate
  const startInterval = useCallback((interval) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        invokeCallback();
        // Check inactivity inline
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity > inactiveThreshold && isActiveRef.current) {
          isActiveRef.current = false;
          startInterval(inactiveInterval);
        }
      }
    }, interval);
  }, [invokeCallback, inactiveThreshold, inactiveInterval]);

  // Update last activity time
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // If was inactive, become active and restart polling at faster rate
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      startInterval(activeInterval);
    }
  }, [activeInterval, startInterval]);

  useEffect(() => {
    // Start polling immediately
    invokeCallback();

    // Set up initial interval
    const currentInterval = isActiveRef.current ? activeInterval : inactiveInterval;
    startInterval(currentInterval);

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - poll immediately and update activity
        updateActivity();
        invokeCallback();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeInterval, inactiveInterval, updateActivity, startInterval, invokeCallback]);

  // Return cleanup function in case component wants to manually stop polling
  return useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
};
