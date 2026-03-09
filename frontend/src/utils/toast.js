import toast from 'react-hot-toast';

/**
 * Toast notification utilities with consistent styling
 */

// Success toast
export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#10B981',
      color: '#FFFFFF',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    iconTheme: {
      primary: '#FFFFFF',
      secondary: '#10B981',
    },
    ...options,
  });
};

// Error toast
export const showError = (message, options = {}) => {
  return toast.error(message, {
    duration: 5000,
    position: 'top-right',
    style: {
      background: '#EF4444',
      color: '#FFFFFF',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    iconTheme: {
      primary: '#FFFFFF',
      secondary: '#EF4444',
    },
    ...options,
  });
};

// Warning/Info toast
export const showWarning = (message, options = {}) => {
  return toast(message, {
    icon: '⚠️',
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#F59E0B',
      color: '#FFFFFF',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    ...options,
  });
};

// Info toast
export const showInfo = (message, options = {}) => {
  return toast(message, {
    icon: 'ℹ️',
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#3B82F6',
      color: '#FFFFFF',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    ...options,
  });
};

// Loading toast
export const showLoading = (message, options = {}) => {
  return toast.loading(message, {
    position: 'top-right',
    style: {
      background: '#6B7280',
      color: '#FFFFFF',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    ...options,
  });
};

// Promise toast (for async operations)
export const showPromise = (promise, messages, options = {}) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'Something went wrong',
    },
    {
      position: 'top-right',
      style: {
        fontWeight: '500',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      },
      ...options,
    }
  );
};

// Custom toast for specific use cases
export const showCustom = (content, options = {}) => {
  return toast.custom(content, {
    position: 'top-right',
    duration: 4000,
    ...options,
  });
};

// Dismiss toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

// Dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss();
};

const toastUtils = {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  loading: showLoading,
  promise: showPromise,
  custom: showCustom,
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
};

export default toastUtils;
