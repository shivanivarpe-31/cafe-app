import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Spinner component for inline loading states
 */
export const Spinner = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };

  return (
    <Loader2
      className={`animate-spin text-red-500 ${sizeClasses[size]} ${className}`}
    />
  );
};

/**
 * Full page loading overlay
 */
export const LoadingOverlay = ({ message = "Loading..." }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center space-y-4 shadow-2xl">
        <Spinner size="xl" />
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
};

/**
 * Inline loading state for sections
 */
export const LoadingSection = ({ message = "Loading...", className = "" }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 ${className}`}
    >
      <Spinner size="lg" />
      <p className="text-gray-600 mt-4">{message}</p>
    </div>
  );
};

/**
 * Skeleton loader for card/list items
 */
export const SkeletonCard = ({ className = "" }) => {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}
    >
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-4/5"></div>
        <div className="flex items-center space-x-2 pt-2">
          <div className="h-8 bg-gray-200 rounded w-20"></div>
          <div className="h-8 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for table rows
 */
export const SkeletonTable = ({ rows = 5 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse flex items-center space-x-4 py-3"
        >
          <div className="h-4 bg-gray-200 rounded w-1/6"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/5"></div>
          <div className="h-4 bg-gray-200 rounded w-1/6"></div>
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
        </div>
      ))}
    </div>
  );
};

/**
 * Grid skeleton loader
 */
export const SkeletonGrid = ({ items = 6, columns = 3 }) => {
  const gridClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${gridClass[columns]} gap-4`}>
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
};

/**
 * Button with loading state
 */
export const LoadingButton = ({
  loading,
  children,
  disabled,
  className = "",
  ...props
}) => {
  return (
    <button
      disabled={loading || disabled}
      className={`flex items-center justify-center space-x-2 ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      <span>{children}</span>
    </button>
  );
};

export default {
  Spinner,
  LoadingOverlay,
  LoadingSection,
  SkeletonCard,
  SkeletonTable,
  SkeletonGrid,
  LoadingButton,
};
