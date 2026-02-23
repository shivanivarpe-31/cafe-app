import { useEffect, useRef, useCallback } from "react";

/**
 * useFocusTrap — hook to trap focus within a container (typically a modal).
 *
 * Usage:
 *   const trapRef = useFocusTrap(isOpen, onClose);
 *   <div ref={trapRef} role="dialog" aria-modal="true" ...>
 *
 * Features:
 * - Traps Tab / Shift+Tab within the container
 * - Closes on Escape key
 * - Moves focus into the container on open
 * - Restores focus to the previously-focused element on close
 * - Prevents body scroll while open
 */
export const useFocusTrap = (isOpen, onClose) => {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);

    const getFocusable = useCallback(() => {
        if (!containerRef.current) return [];
        return Array.from(
            containerRef.current.querySelectorAll(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
        );
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        previousFocusRef.current = document.activeElement;

        // Move focus into the modal
        const raf = requestAnimationFrame(() => {
            const focusable = getFocusable();
            if (focusable.length > 0) {
                focusable[0].focus();
            } else if (containerRef.current) {
                containerRef.current.focus();
            }
        });

        // Lock body scroll
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
                return;
            }

            if (e.key === "Tab") {
                const focusable = getFocusable();
                if (focusable.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = prev;
            if (previousFocusRef.current && previousFocusRef.current.focus) {
                previousFocusRef.current.focus();
            }
        };
    }, [isOpen, onClose, getFocusable]);

    return containerRef;
};
