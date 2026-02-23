import React from "react";
import { X, Keyboard } from "lucide-react";
import { formatShortcut } from "../hooks/useKeyboardShortcuts";
import { useFocusTrap } from "../hooks/useFocusTrap";

const KeyboardShortcutsHelp = ({ isOpen, onClose }) => {
  const focusTrapRef = useFocusTrap(isOpen, onClose);
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: "Navigation",
      items: [
        { keys: "ctrl+d", description: "Go to Dashboard" },
        { keys: "ctrl+b", description: "Go to Billing / New Order" },
        { keys: "ctrl+m", description: "Go to Menu Management" },
        { keys: "ctrl+o", description: "Go to Orders" },
        { keys: "ctrl+i", description: "Go to Inventory" },
        { keys: "ctrl+r", description: "Go to Reports" },
        { keys: "ctrl+l", description: "Go to Delivery Orders" },
        { keys: "ctrl+k", description: "Go to Kitchen Display" },
      ],
    },
    {
      category: "Actions",
      items: [
        { keys: "ctrl+s", description: "Save / Submit Form" },
        { keys: "escape", description: "Close Modal / Cancel" },
        { keys: "ctrl+f", description: "Focus Search" },
        { keys: "?", description: "Show Keyboard Shortcuts" },
      ],
    },
    {
      category: "Dashboard",
      items: [
        { keys: "1", description: "Filter: All Tables" },
        { keys: "2", description: "Filter: Available" },
        { keys: "3", description: "Filter: Occupied" },
        { keys: "4", description: "Filter: Reserved" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            id="keyboard-shortcuts-title"
            className="text-2xl font-bold text-gray-900 flex items-center"
          >
            <Keyboard className="w-6 h-6 mr-3 text-red-500" />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {shortcuts.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-gray-700">{item.description}</span>
                    <kbd className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono font-semibold text-gray-900 shadow-sm">
                      {formatShortcut(item.keys)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <strong>Pro tip:</strong> Press{" "}
            <kbd className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono mx-1">
              ?
            </kbd>
            at any time to view this help screen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
