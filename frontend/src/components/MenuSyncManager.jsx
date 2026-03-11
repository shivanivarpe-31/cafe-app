import React, { useState, useEffect, useCallback } from "react";
import useIntegration from "../hooks/useIntegration";
import "./MenuSyncManager.css";

const MenuSyncManager = () => {
  const {
    loading,
    error,
    syncMenu,
    previewMenuSync,
    fetchPlatformMenu,
    syncStock,
    toggleItemStock,
  } = useIntegration();

  const [selectedPlatform, setSelectedPlatform] = useState("zomato");
  const [preview, setPreview] = useState(null);
  const [platformMenu, setPlatformMenu] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [stockResult, setStockResult] = useState(null);
  const [message, setMessage] = useState(null);

  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Load preview on platform change
  const loadPreview = useCallback(async () => {
    try {
      const data = await previewMenuSync(selectedPlatform);
      setPreview(data);
    } catch {
      // error handled by hook
    }
  }, [previewMenuSync, selectedPlatform]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Push full menu to platform
  const handleSyncMenu = async () => {
    try {
      setSyncResult(null);
      const result = await syncMenu(selectedPlatform);
      setSyncResult(result);
      showMessage(
        result.message || "Menu synced successfully!",
        result.success ? "success" : "error",
      );
    } catch (err) {
      showMessage(err.message || "Menu sync failed", "error");
    }
  };

  // Fetch current menu from platform
  const handleFetchMenu = async () => {
    try {
      setPlatformMenu(null);
      const result = await fetchPlatformMenu(selectedPlatform);
      setPlatformMenu(result);
    } catch (err) {
      showMessage(err.message || "Failed to fetch menu", "error");
    }
  };

  // Sync all stock statuses
  const handleSyncStock = async () => {
    try {
      setStockResult(null);
      const result = await syncStock(selectedPlatform);
      setStockResult(result);
      showMessage(
        result.message || "Stock synced successfully!",
        result.success ? "success" : "error",
      );
    } catch (err) {
      showMessage(err.message || "Stock sync failed", "error");
    }
  };

  // Toggle single item stock
  const handleToggleStock = async (menuItemId, itemName, currentInStock) => { // eslint-disable-line no-unused-vars
    try {
      await toggleItemStock(selectedPlatform, menuItemId, !currentInStock);
      showMessage(
        `${itemName} marked as ${
          !currentInStock ? "In Stock" : "Out of Stock"
        } on ${selectedPlatform}`,
        "success",
      );
      // Refresh preview
      loadPreview();
    } catch (err) {
      showMessage(err.message || "Failed to toggle stock", "error");
    }
  };

  return (
    <div className="menu-sync-manager">
      <div className="menu-sync-header">
        <h2>🔄 Menu Sync Manager</h2>
        <p>Push your menu to delivery platforms and manage stock visibility</p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`sync-message ${message.type}`}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {error && <div className="sync-message error">❌ {error}</div>}

      {/* Platform Selector */}
      <div className="platform-selector">
        <button
          className={`platform-btn ${
            selectedPlatform === "zomato" ? "active zomato" : ""
          }`}
          onClick={() => setSelectedPlatform("zomato")}
        >
          🍕 Zomato
        </button>
        <button
          className={`platform-btn ${
            selectedPlatform === "swiggy" ? "active swiggy" : ""
          }`}
          onClick={() => setSelectedPlatform("swiggy")}
        >
          🍔 Swiggy
        </button>
      </div>

      {/* Action Cards */}
      <div className="sync-actions-grid">
        {/* Push Menu Card */}
        <div className="sync-action-card">
          <div className="action-header">
            <span className="action-icon">📤</span>
            <h3>Push Menu</h3>
          </div>
          <p className="action-desc">
            Send your full menu (categories, items, add-ons) to{" "}
            {selectedPlatform === "zomato" ? "Zomato" : "Swiggy"}. This will
            update all items, prices, and availability.
          </p>
          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleSyncMenu}
              disabled={loading}
            >
              {loading ? "⏳ Syncing..." : "🚀 Push Menu Now"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={loadPreview}
              disabled={loading}
            >
              👁️ Preview
            </button>
          </div>
          {syncResult && (
            <div className="action-result success">✅ {syncResult.message}</div>
          )}
        </div>

        {/* Fetch Menu Card */}
        <div className="sync-action-card">
          <div className="action-header">
            <span className="action-icon">📥</span>
            <h3>Fetch Platform Menu</h3>
          </div>
          <p className="action-desc">
            Retrieve the current menu as it exists on{" "}
            {selectedPlatform === "zomato" ? "Zomato" : "Swiggy"} to compare
            with your local menu.
          </p>
          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleFetchMenu}
              disabled={loading}
            >
              {loading ? "⏳ Fetching..." : "📥 Fetch Menu"}
            </button>
          </div>
        </div>

        {/* Stock Sync Card */}
        <div className="sync-action-card">
          <div className="action-header">
            <span className="action-icon">📦</span>
            <h3>Sync Stock Status</h3>
          </div>
          <p className="action-desc">
            Update stock availability for all mapped items on{" "}
            {selectedPlatform === "zomato" ? "Zomato" : "Swiggy"}. Items with
            low/zero inventory will be marked as unavailable.
          </p>
          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleSyncStock}
              disabled={loading}
            >
              {loading ? "⏳ Syncing..." : "📦 Sync All Stock"}
            </button>
          </div>
          {stockResult && (
            <div className="action-result success">
              ✅ {stockResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Menu Preview Section */}
      {preview && preview.preview && (
        <div className="menu-preview-section">
          <h3>📋 Menu Preview — What will be sent</h3>

          {/* Validation Errors */}
          {preview.validation && !preview.validation.valid && (
            <div className="validation-errors">
              <h4>⚠️ Validation Errors ({preview.validation.errors.length})</h4>
              <ul>
                {preview.validation.errors.map((err, i) => (
                  <li key={i} className="validation-error">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.validation && preview.validation.valid && (
            <div className="validation-success">
              ✅ Payload is valid — ready to push
            </div>
          )}

          {/* Notes / Warnings */}
          {preview.notes && (
            <div className="sync-notes">
              {preview.notes.map((note, i) => (
                <div key={i} className="sync-note">
                  ℹ️ {note}
                </div>
              ))}
            </div>
          )}

          <div className="preview-summary">
            <div className="summary-stat">
              <span className="stat-value">
                {preview.summary?.categories || 0}
              </span>
              <span className="stat-label">Categories</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">
                {preview.summary?.rootItems ||
                  preview.summary?.totalCatalogues ||
                  0}
              </span>
              <span className="stat-label">Menu Items</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">
                {preview.summary?.addonItems || 0}
              </span>
              <span className="stat-label">Add-on Items</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">
                {preview.summary?.modifierGroups || 0}
              </span>
              <span className="stat-label">Modifier Groups</span>
            </div>
          </div>

          {/* Categories → SubCategories → Entities (linked to catalogues) */}
          <div className="preview-categories">
            {preview.preview.categories?.map((cat, catIdx) => (
              <div key={catIdx} className="preview-category">
                <div className="category-name">
                  {cat.name}
                  <span className="vendor-id">{cat.vendorEntityId}</span>
                </div>
                {cat.subCategories?.map((sub, subIdx) => (
                  <div key={subIdx} className="subcategory-section">
                    {cat.subCategories.length > 1 && (
                      <div className="subcategory-name">{sub.name}</div>
                    )}
                    <div className="category-items">
                      {sub.entities?.map((entity, entIdx) => {
                        // Find the matching catalogue
                        const catalogue = (
                          preview.preview.catalogues || []
                        ).find(
                          (c) => c.vendorEntityId === entity.vendorEntityId,
                        );
                        if (!catalogue) return null;
                        const price =
                          catalogue.variants?.[0]?.prices?.[0]?.value;
                        const dietaryTag = (catalogue.tags || []).find(
                          (t) => t.tagGroup === "Dietary",
                        );
                        return (
                          <div key={entIdx} className="preview-item">
                            <div className="item-info">
                              <span className="item-name">
                                {dietaryTag && (
                                  <span
                                    className={`dietary-badge ${dietaryTag.tag}`}
                                  >
                                    {dietaryTag.tag === "veg"
                                      ? "🟢"
                                      : dietaryTag.tag === "egg"
                                      ? "🟡"
                                      : "🔴"}
                                  </span>
                                )}
                                {catalogue.name}
                              </span>
                              {price !== undefined && (
                                <span className="item-price">₹{price}</span>
                              )}
                            </div>
                            <div className="item-stock-toggle">
                              <span
                                className={`stock-badge ${
                                  catalogue.inStock
                                    ? "in-stock"
                                    : "out-of-stock"
                                }`}
                              >
                                {catalogue.inStock
                                  ? "In Stock"
                                  : "Out of Stock"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Modifier Groups */}
          {preview.preview.modifierGroups?.length > 0 && (
            <div className="preview-addons">
              <h4>Modifier Groups (Add-ons)</h4>
              {preview.preview.modifierGroups.map((mg, gIdx) => (
                <div key={gIdx} className="addon-group">
                  <div className="group-name">
                    {mg.name}
                    <span className="mg-range">
                      min: {mg.min}, max: {mg.max}
                    </span>
                  </div>
                  <div className="group-items">
                    {mg.variants?.map((v, vIdx) => {
                      const addonCat = (preview.preview.catalogues || []).find(
                        (c) => c.vendorEntityId === v.catalogueVendorEntityId,
                      );
                      const addonPrice =
                        addonCat?.variants?.[0]?.prices?.[0]?.value;
                      return (
                        <span key={vIdx} className="addon-chip">
                          {addonCat?.name || v.vendorEntityId}{" "}
                          {addonPrice > 0 ? `(+₹${addonPrice})` : "(Free)"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Platform Menu Section */}
      {platformMenu && platformMenu.menu && (
        <div className="platform-menu-section">
          <h3>
            📄 Current Menu on{" "}
            {selectedPlatform === "zomato" ? "Zomato" : "Swiggy"}
          </h3>
          <pre className="menu-json">
            {JSON.stringify(platformMenu.menu, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default MenuSyncManager;
