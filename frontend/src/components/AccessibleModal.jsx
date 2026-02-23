import React, { useEffect, useRef, useCallback } from "react";

/**
 * AccessibleModal — reusable modal wrapper with full accessibility support.
 *
 * Features:
 * - role="dialog", aria-modal="true", aria-labelledby / aria-label
 * - Focus trapping (Tab / Shift+Tab cycle within modal)
 * - Returns focus to the trigger element on close
 * - Escape key closes the modal
 * - Backdrop click closes the modal
 * - Prevents body scroll while open
 *
 * Props:
 *   isOpen      — boolean, controls visibility
 *   onClose     — function, called to close the modal
 *   title       — string, visible title rendered as <h2> (also used for aria-labelledby)
 *   titleId     — string, optional custom id for the title element (default: "modal-title")
 *   ariaLabel   — string, used instead of titleId when no visible title is rendered
 *   children    — modal body content
 *   className   — optional extra classes on the dialog panel
 *   showClose   — boolean, show the X close button (default: true)
 *   size        — "sm" | "md" | "lg" | "xl" | "full" (default: "md")
 */
const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-full mx-4",
};

const AccessibleModal = ({
  isOpen,
  onClose,
  title,
  titleId = "modal-title",
  ariaLabel,
  children,
  className = "",
  showClose = true,
  size = "md",
}) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Gather all focusable elements inside the dialog
  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }, []);

  // Focus trap: keep focus cycling within the modal
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose, getFocusableElements],
  );

  // On open: save previous focus, move focus into modal, lock body scroll
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    // Small delay to ensure the DOM has rendered
    const timer = requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    });

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(timer);
      document.body.style.overflow = originalOverflow;

      // Restore focus
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, getFocusableElements]);

  if (!isOpen) return null;

  const labelProps = title
    ? { "aria-labelledby": titleId }
    : ariaLabel
    ? { "aria-label": ariaLabel }
    : {};

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        {...labelProps}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative w-full ${
          SIZES[size] || SIZES.md
        } rounded-xl bg-white shadow-2xl outline-none ${className}`}
      >
        {/* Header with title and close button */}
        {(title || showClose) && (
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
};

export default AccessibleModal;
