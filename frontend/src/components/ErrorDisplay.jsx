import React from "react";
import { AlertCircle, X } from "lucide-react";

/**
 * ErrorDisplay component for showing structured error messages
 * Supports both simple error messages and detailed breakdowns (e.g., ingredient shortages)
 */
const ErrorDisplay = ({ error, onDismiss, className = "" }) => {
  if (!error) return null;

  // If error is a string, convert to object
  const errorObj = typeof error === "string" ? { message: error } : error;

  // Check if this is a structured error with details
  const hasDetails =
    errorObj.details &&
    Array.isArray(errorObj.details) &&
    errorObj.details.length > 0;
  const hasItems =
    errorObj.items &&
    Array.isArray(errorObj.items) &&
    errorObj.items.length > 0;

  return (
    <div
      className={`bg-red-50 border-2 border-red-200 rounded-xl p-4 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {/* Main error title/message */}
            <h4 className="font-semibold text-red-900 mb-1">
              {errorObj.title || "Error"}
            </h4>

            {/* Main error message */}
            {errorObj.message && (
              <p className="text-sm text-red-700 mb-2">{errorObj.message}</p>
            )}

            {/* Detailed breakdown (e.g., ingredient shortages) */}
            {hasItems && (
              <div className="mt-3 space-y-2">
                {errorObj.items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg p-3 border border-red-200"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-red-900 text-sm">
                        {item.ingredient}{" "}
                        {item.menuItem && `(${item.menuItem})`}
                      </div>
                      {item.shortage && (
                        <span className="text-xs text-red-600 font-mono">
                          Short: {item.shortage}
                          {item.unit}
                        </span>
                      )}
                    </div>
                    {item.required && item.available ? (
                      <div className="text-sm text-red-700 flex items-center space-x-4">
                        <span>
                          Need:{" "}
                          <span className="font-medium">
                            {item.required}
                            {item.unit}
                          </span>
                        </span>
                        <span>
                          Have:{" "}
                          <span className="font-medium">
                            {item.available}
                            {item.unit}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-red-700">{item.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legacy details format (non-array) */}
            {hasDetails && (
              <div className="mt-3 space-y-2">
                {errorObj.details.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg p-3 border border-red-200"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-red-900 text-sm">
                        {item.ingredient}{" "}
                        {item.menuItem && `(${item.menuItem})`}
                      </div>
                      <span className="text-xs text-red-600 font-mono">
                        Short: {item.shortage}
                        {item.unit}
                      </span>
                    </div>
                    <div className="text-sm text-red-700 flex items-center space-x-4">
                      <span>
                        Need:{" "}
                        <span className="font-medium">
                          {item.required}
                          {item.unit}
                        </span>
                      </span>
                      <span>
                        Have:{" "}
                        <span className="font-medium">
                          {item.available}
                          {item.unit}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error code (for debugging) */}
            {errorObj.code && errorObj.code !== "UNKNOWN_ERROR"}
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0 ml-2"
            aria-label="Dismiss error"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
