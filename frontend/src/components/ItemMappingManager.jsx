/**
 * ItemMappingManager Component
 * Displays and manages menu item to platform ID mappings
 */

import React, { useState, useContext, useEffect } from "react";
import IntegrationContext from "../context/IntegrationContext";
import "./ItemMappingManager.css";

const ItemMappingManager = () => {
  const {
    mappings,
    stats,
    selectedPlatform,
    setSelectedPlatform,
    handleCreateMapping,
    handleDeleteMapping,
    loadMappings,
    error,
    loading,
  } = useContext(IntegrationContext);
  const [formData, setFormData] = useState({
    menuItemId: "",
    platform: "SWIGGY",
    platformItemId: "",
    platformItemName: "",
    platformPrice: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [showForm, setShowForm] = useState(false);

  // Filter mappings
  const filteredMappings = mappings.filter((m) => {
    const platformMatch =
      filterPlatform === "ALL" || m.platform === filterPlatform;
    const searchMatch =
      !searchTerm ||
      m.menuItem?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.platformItemName?.toLowerCase().includes(searchTerm.toLowerCase());
    return platformMatch && searchMatch;
  });

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.menuItemId || !formData.platformItemId) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      await handleCreateMapping({
        menuItemId: parseInt(formData.menuItemId),
        platform: formData.platform,
        platformItemId: formData.platformItemId,
        platformItemName: formData.platformItemName || undefined,
        platformPrice: formData.platformPrice
          ? parseFloat(formData.platformPrice)
          : undefined,
      });

      setFormData({
        menuItemId: "",
        platform: "SWIGGY",
        platformItemId: "",
        platformItemName: "",
        platformPrice: "",
      });
      setShowForm(false);
      alert("Mapping created successfully!");
    } catch (err) {
      alert("Failed to create mapping: " + err.message);
    }
  };

  // Handle delete
  const handleDelete = async (mappingId) => {
    if (!window.confirm("Are you sure you want to delete this mapping?"))
      return;

    try {
      await handleDeleteMapping(mappingId);
      alert("Mapping deleted successfully!");
    } catch (err) {
      alert("Failed to delete mapping: " + err.message);
    }
  };

  return (
    <div className="item-mapping-container">
      <div className="mapping-header">
        <h2>📦 Item Mapping Management</h2>
        <p className="subtitle">Map your menu items to platform item IDs</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Mappings</div>
            <div className="stat-value">{stats.mappings?.total || 0}</div>
          </div>
          <div className="stat-card swiggy">
            <div className="stat-label">🍔 Swiggy Mappings</div>
            <div className="stat-value">
              {stats.mappings?.byPlatform?.swiggy || 0}
            </div>
          </div>
          <div className="stat-card zomato">
            <div className="stat-label">🍕 Zomato Mappings</div>
            <div className="stat-value">
              {stats.mappings?.byPlatform?.zomato || 0}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Platform Orders</div>
            <div className="stat-value">{stats.orders?.fromPlatforms || 0}</div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && <div className="error-banner">⚠️ {error}</div>}

      {/* Form Section */}
      <div className="form-section">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "✕ Cancel" : "+ Add Mapping"}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="mapping-form">
            <div className="form-group">
              <label>Menu Item ID *</label>
              <input
                type="number"
                value={formData.menuItemId}
                onChange={(e) =>
                  setFormData({ ...formData, menuItemId: e.target.value })
                }
                placeholder="Enter menu item ID"
                required
              />
            </div>

            <div className="form-group">
              <label>Platform *</label>
              <select
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value })
                }
              >
                <option value="SWIGGY">Swiggy</option>
                <option value="ZOMATO">Zomato</option>
              </select>
            </div>

            <div className="form-group">
              <label>Platform Item ID *</label>
              <input
                type="text"
                value={formData.platformItemId}
                onChange={(e) =>
                  setFormData({ ...formData, platformItemId: e.target.value })
                }
                placeholder="e.g., swiggy_item_123"
                required
              />
            </div>

            <div className="form-group">
              <label>Platform Item Name</label>
              <input
                type="text"
                value={formData.platformItemName}
                onChange={(e) =>
                  setFormData({ ...formData, platformItemName: e.target.value })
                }
                placeholder="Optional - will default to menu item name"
              />
            </div>

            <div className="form-group">
              <label>Platform Price</label>
              <input
                type="number"
                value={formData.platformPrice}
                onChange={(e) =>
                  setFormData({ ...formData, platformPrice: e.target.value })
                }
                placeholder="Optional - will default to menu item price"
                step="0.01"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create Mapping"}
            </button>
          </form>
        )}
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          {["ALL", "SWIGGY", "ZOMATO"].map((platform) => (
            <button
              key={platform}
              className={`filter-btn ${
                filterPlatform === platform ? "active" : ""
              }`}
              onClick={() => setFilterPlatform(platform)}
            >
              {platform === "SWIGGY" && "🍔"}
              {platform === "ZOMATO" && "🍕"}
              {platform === "ALL" && "📋"} {platform}
            </button>
          ))}
        </div>
      </div>

      {/* Mappings Table */}
      <div className="mappings-table-container">
        {filteredMappings.length > 0 ? (
          <table className="mappings-table">
            <thead>
              <tr>
                <th>Menu Item</th>
                <th>Category</th>
                <th>Price</th>
                <th>Platform</th>
                <th>Platform Item ID</th>
                <th>Platform Name</th>
                <th>Last Synced</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td className="font-bold">
                    {mapping.menuItem?.name || "N/A"}
                  </td>
                  <td>{mapping.menuItem?.category?.name || "N/A"}</td>
                  <td>₹{mapping.menuItem?.price || "N/A"}</td>
                  <td>
                    <span
                      className={`platform-badge ${mapping.platform.toLowerCase()}`}
                    >
                      {mapping.platform === "SWIGGY" && "🍔"}
                      {mapping.platform === "ZOMATO" && "🍕"} {mapping.platform}
                    </span>
                  </td>
                  <td className="mono">{mapping.platformItemId}</td>
                  <td>{mapping.platformItemName}</td>
                  <td className="text-sm">
                    {mapping.lastSyncedAt
                      ? new Date(mapping.lastSyncedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td>
                    <button
                      className="btn-danger-small"
                      onClick={() => handleDelete(mapping.id)}
                      disabled={loading}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>📭 No mappings found</p>
            <p className="text-muted">
              Create your first mapping to get started
            </p>
          </div>
        )}
      </div>

      {/* Count Info */}
      <div className="footer-info">
        Showing {filteredMappings.length} of {mappings.length} mappings
      </div>
    </div>
  );
};

export default ItemMappingManager;
