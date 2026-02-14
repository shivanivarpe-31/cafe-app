import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { user, isChef } = useAuth();

  const handleGoBack = () => {
    // Chef should go to kitchen display, others to dashboard
    if (isChef()) {
      navigate("/kitchen");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>

        <p className="text-gray-600 mb-2">
          You don't have permission to access this page.
        </p>

        {user && (
          <p className="text-sm text-gray-500 mb-6">
            Your current role:{" "}
            <span className="font-semibold">{user.role}</span>
          </p>
        )}

        <button
          onClick={handleGoBack}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Back to Home
        </button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
