import { useEffect, useRef, useCallback } from 'react';

/**
 * Smart polling hook that respects page visibility and user activity
 *
 * Features:
 * - Only polls when page is visible
 * - Stops polling when user switches tabs
 * - Reduces polling frequency when user is inactive
 * - Automatically resumes when user returns
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

  // Update last activity time
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // If was inactive, become active and restart polling at faster rate
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          if (document.visibilityState === 'visible') {
            callback();
          }
        }, activeInterval);
      }
    }
  }, [callback, activeInterval]);

  // Check if user is inactive
  const checkInactivity = useCallback(() => {
    const timeSinceLastActivity = Date.now() - lastActivityRef.current;

    if (timeSinceLastActivity > inactiveThreshold && isActiveRef.current) {
      // User is now inactive, slow down polling
      isActiveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          if (document.visibilityState === 'visible') {
            callback();
          }
        }, inactiveInterval);
      }
    }
  }, [callback, inactiveThreshold, inactiveInterval]);

  useEffect(() => {
    // Start polling immediately
    callback();

    // Set up initial interval
    const currentInterval = isActiveRef.current ? activeInterval : inactiveInterval;
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        callback();
        checkInactivity();
      }
    }, currentInterval);

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
        callback();
      } else {
        // Page hidden - polling will be skipped by the interval check
        // But interval keeps running to check visibility
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
  }, [callback, activeInterval, inactiveInterval, updateActivity, checkInactivity]);

  // Return cleanup function in case component wants to manually stop polling
  return useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
};
