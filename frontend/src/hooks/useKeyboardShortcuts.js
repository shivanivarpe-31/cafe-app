import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook for global keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to handlers
 * @param {boolean} enabled - Whether shortcuts are enabled (default: true)
 */
export const useKeyboardShortcuts = (shortcuts = {}, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in input fields, textareas, or content-editable elements
      const target = event.target;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[role="textbox"]');

      // Allow ESC key even in input fields
      if (isInputField && event.key !== 'Escape') return;

      // Build the key combination string
      const modifiers = [];
      if (event.ctrlKey || event.metaKey) modifiers.push('ctrl');
      if (event.altKey) modifiers.push('alt');
      if (event.shiftKey) modifiers.push('shift');

      const key = event.key.toLowerCase();
      const combination = [...modifiers, key].join('+');

      // Check for exact match or just key match
      const handler = shortcuts[combination] || shortcuts[key];

      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
};

/**
 * Hook for common navigation shortcuts
 */
export const useNavigationShortcuts = () => {
  const navigate = useNavigate();

  const shortcuts = {
    'ctrl+b': () => navigate('/billing'),
    'ctrl+d': () => navigate('/dashboard'),
    'ctrl+m': () => navigate('/menu'),
    'ctrl+i': () => navigate('/inventory'),
    'ctrl+r': () => navigate('/reports'),
    'ctrl+o': () => navigate('/orders'),
    'ctrl+l': () => navigate('/delivery'),
    'ctrl+k': () => navigate('/kitchen'),
  };

  useKeyboardShortcuts(shortcuts);
};

/**
 * Format shortcut for display
 */
export const formatShortcut = (shortcut) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return shortcut
    .replace('ctrl', isMac ? '⌘' : 'Ctrl')
    .replace('alt', isMac ? '⌥' : 'Alt')
    .replace('shift', isMac ? '⇧' : 'Shift')
    .split('+')
    .map(key => key.charAt(0).toUpperCase() + key.slice(1))
    .join(isMac ? '' : '+');
};
