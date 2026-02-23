import React, { useState } from "react";
import { X, Users, Link as LinkIcon, Unlink } from "lucide-react";
import axios from "axios";
import { showSuccess, showError } from "../utils/toast";
import { useFocusTrap } from "../hooks/useFocusTrap";

const TableMergeModal = ({ isOpen, onClose, tables, onTablesUpdated }) => {
  const [selectedTables, setSelectedTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const focusTrapRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  // Get available tables (not already merged and not occupied with orders)
  const availableTables = tables.filter((t) => !t.isMerged);

  // Get merged groups
  const mergedGroups = {};
  tables
    .filter((t) => t.isMerged && t.mergedGroupId)
    .forEach((table) => {
      if (!mergedGroups[table.mergedGroupId]) {
        mergedGroups[table.mergedGroupId] = [];
      }
      mergedGroups[table.mergedGroupId].push(table);
    });

  // Toggle table selection
  const toggleTableSelection = (tableId) => {
    setSelectedTables((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId],
    );
  };

  // Merge selected tables
  const handleMerge = async () => {
    if (selectedTables.length < 2) {
      showError("Please select at least 2 tables to merge");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/tables/merge", {
        tableIds: selectedTables,
      });

      showSuccess(
        `Tables ${selectedTables
          .map((id) => tables.find((t) => t.id === id)?.number)
          .join(", ")} merged successfully!`,
      );
      setSelectedTables([]);
      onTablesUpdated();
    } catch (err) {
      console.error("Merge error:", err);
      showError(err.response?.data?.error || "Failed to merge tables");
    } finally {
      setLoading(false);
    }
  };

  // Split merged tables
  const handleSplit = async (mergedGroupId) => {
    setLoading(true);
    try {
      await axios.post("/api/tables/split", { mergedGroupId });

      showSuccess("Tables split successfully!");
      onTablesUpdated();
    } catch (err) {
      console.error("Split error:", err);
      showError(err.response?.data?.error || "Failed to split tables");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-merge-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2
              id="table-merge-title"
              className="text-2xl font-bold text-gray-900 flex items-center"
            >
              <LinkIcon className="w-6 h-6 mr-2 text-red-500" />
              Manage Table Merging
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Merge tables for larger groups or split merged tables
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Available Tables */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500" />
              Available Tables
              {selectedTables.length > 0 && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {selectedTables.length} selected
                </span>
              )}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {availableTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => toggleTableSelection(table.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedTables.includes(table.id)
                      ? "border-blue-500 bg-blue-50"
                      : table.status === "AVAILABLE"
                      ? "border-gray-200 bg-white hover:border-blue-300"
                      : "border-gray-200 bg-gray-50 opacity-50"
                  }`}
                  disabled={table.status !== "AVAILABLE"}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {table.number}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {table.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Capacity: {table.capacity}
                    </div>
                    {selectedTables.includes(table.id) && (
                      <div className="mt-2">
                        <span className="inline-flex w-6 h-6 bg-blue-500 rounded-full text-white text-xs items-center justify-center">
                          ✓
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {availableTables.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No available tables to merge
              </div>
            )}
          </div>

          {/* Currently Merged Tables */}
          {Object.keys(mergedGroups).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-orange-500" />
                Merged Table Groups
              </h3>

              <div className="space-y-3">
                {Object.entries(mergedGroups).map(([groupId, groupTables]) => {
                  const totalCapacity = groupTables.reduce(
                    (sum, t) => sum + t.capacity,
                    0,
                  );
                  const tableNumbers = groupTables
                    .map((t) => t.number)
                    .sort((a, b) => a - b);

                  return (
                    <div
                      key={groupId}
                      className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 flex items-center">
                            <LinkIcon className="w-4 h-4 mr-2 text-orange-500" />
                            Tables {tableNumbers.join(" + ")}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Total Capacity: {totalCapacity} guests
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {groupTables.length} tables merged
                          </div>
                        </div>
                        <button
                          onClick={() => handleSplit(groupId)}
                          disabled={loading}
                          className="px-4 py-2 bg-white hover:bg-orange-100 text-orange-600 font-semibold rounded-lg border-2 border-orange-300 transition-all flex items-center space-x-2 disabled:opacity-50"
                        >
                          <Unlink className="w-4 h-4" />
                          <span>Split</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {availableTables.length > 0 && (
          <div className="border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedTables.length >= 2 ? (
                  <span className="text-green-600 font-medium">
                    ✓ Ready to merge {selectedTables.length} tables
                  </span>
                ) : (
                  <span>Select at least 2 tables to merge</span>
                )}
                {selectedTables.length >= 2 && (
                  <span className="ml-2 text-gray-500">
                    (Total capacity:{" "}
                    {selectedTables.reduce(
                      (sum, id) =>
                        sum + (tables.find((t) => t.id === id)?.capacity || 0),
                      0,
                    )}{" "}
                    guests)
                  </span>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={handleMerge}
                  disabled={loading || selectedTables.length < 2}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <LinkIcon className="w-5 h-5" />
                  <span>{loading ? "Merging..." : "Merge Tables"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableMergeModal;
