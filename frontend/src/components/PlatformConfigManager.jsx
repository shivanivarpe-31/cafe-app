/**
 * PlatformConfigManager Component
 * Manages Swiggy & Zomato credentials, configuration, and connection testing
 */

import React, { useState, useEffect, useCallback } from "react";
import useIntegration from "../hooks/useIntegration";
import "./PlatformConfigManager.css";

const PLATFORMS = [
  {
    key: "SWIGGY",
    label: "Swiggy",
    icon: "🍔",
    color: "#fc8019",
    description: "Swiggy restaurant partner integration",
  },
  {
    key: "ZOMATO",
    label: "Zomato",
    icon: "🍕",
    color: "#e23744",
    description: "Zomato restaurant partner integration",
  },
];

const DEFAULT_CONFIG = {
  isEnabled: false,
  apiKey: "",
  restaurantId: "",
  webhookSecret: "",
  autoAcceptOrders: false,
  defaultPrepTime: 30,
  menuSyncEnabled: false,
  statusUpdateEnabled: true,
};

const PlatformConfigManager = () => {
  const {
    loading,
    getPlatformConfigs,
    updatePlatformConfig,
    testPlatformConnection,
  } = useIntegration();

  const [configs, setConfigs] = useState({});
  const [editForms, setEditForms] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [saving, setSaving] = useState({});
  const [successMsg, setSuccessMsg] = useState({});
  const [errorMsg, setErrorMsg] = useState({});

  // Load configs on mount
  const loadConfigs = useCallback(async () => {
    try {
      const response = await getPlatformConfigs();
      const configMap = {};
      const formMap = {};
      for (const platform of PLATFORMS) {
        const found = (response.configs || []).find(
          (c) => c.platform === platform.key,
        );
        configMap[platform.key] = found || {
          ...DEFAULT_CONFIG,
          platform: platform.key,
        };
        formMap[platform.key] = {
          ...DEFAULT_CONFIG,
          ...found,
          // Don't pre-fill masked values in form
          apiKey: "",
          webhookSecret: "",
        };
      }
      setConfigs(configMap);
      setEditForms(formMap);
    } catch {
      // Show error
    }
  }, [getPlatformConfigs]);

  useEffect(() => {
    loadConfigs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFieldChange = (platform, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const handleSave = async (platform) => {
    setSaving((prev) => ({ ...prev, [platform]: true }));
    setSuccessMsg((prev) => ({ ...prev, [platform]: "" }));
    setErrorMsg((prev) => ({ ...prev, [platform]: "" }));

    try {
      const form = editForms[platform];
      const payload = {
        isEnabled: form.isEnabled,
        restaurantId: form.restaurantId,
        autoAcceptOrders: form.autoAcceptOrders,
        defaultPrepTime: form.defaultPrepTime,
        menuSyncEnabled: form.menuSyncEnabled,
        statusUpdateEnabled: form.statusUpdateEnabled,
      };
      // Only send secrets if user typed something new
      if (form.apiKey) payload.apiKey = form.apiKey;
      if (form.webhookSecret) payload.webhookSecret = form.webhookSecret;

      await updatePlatformConfig(platform, payload);
      setSuccessMsg((prev) => ({
        ...prev,
        [platform]: "Configuration saved successfully!",
      }));
      // Reload to get masked values
      await loadConfigs();
      // Clear test results since config changed
      setTestResults((prev) => ({ ...prev, [platform]: null }));
    } catch (err) {
      setErrorMsg((prev) => ({
        ...prev,
        [platform]: err.message || "Failed to save configuration",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const handleTestConnection = async (platform) => {
    setTesting((prev) => ({ ...prev, [platform]: true }));
    setTestResults((prev) => ({ ...prev, [platform]: null }));

    try {
      const response = await testPlatformConnection(platform);
      setTestResults((prev) => ({ ...prev, [platform]: response.results }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [platform]: {
          overallStatus: "fail",
          checks: [
            {
              name: "Connection",
              status: "fail",
              message: err.message || "Test failed",
            },
          ],
        },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pass":
        return "✅";
      case "warning":
        return "⚠️";
      case "fail":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pass":
        return "#16a34a";
      case "warning":
        return "#d97706";
      case "fail":
        return "#dc2626";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="platform-config-manager">
      <div className="config-header">
        <h2>🔧 Platform Configuration</h2>
        <p>
          Configure credentials and settings for Swiggy & Zomato integrations.
          Use "Test Connection" to verify your setup.
        </p>
      </div>

      <div className="platform-configs">
        {PLATFORMS.map((platform) => {
          const config = configs[platform.key] || {};
          const form = editForms[platform.key] || DEFAULT_CONFIG;
          const result = testResults[platform.key];

          return (
            <div
              key={platform.key}
              className="platform-config-card"
              style={{ borderTopColor: platform.color }}
            >
              {/* Card Header */}
              <div className="config-card-header">
                <div className="platform-info">
                  <span className="platform-icon">{platform.icon}</span>
                  <div>
                    <h3>{platform.label}</h3>
                    <p>{platform.description}</p>
                  </div>
                </div>
                <label className="enable-toggle">
                  <input
                    type="checkbox"
                    checked={form.isEnabled || false}
                    onChange={(e) =>
                      handleFieldChange(
                        platform.key,
                        "isEnabled",
                        e.target.checked,
                      )
                    }
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">
                    {form.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              {/* Credentials Section */}
              <div className="config-section">
                <h4>🔑 Credentials</h4>
                <div className="config-fields">
                  <div className="config-field">
                    <label>API Key</label>
                    <input
                      type="password"
                      placeholder={
                        config.hasApiKey
                          ? "••••••••  (saved — leave blank to keep)"
                          : "Enter API key from partner dashboard"
                      }
                      value={form.apiKey || ""}
                      onChange={(e) =>
                        handleFieldChange(
                          platform.key,
                          "apiKey",
                          e.target.value,
                        )
                      }
                      autoComplete="off"
                    />
                    {config.hasApiKey && (
                      <span className="field-status saved">✓ Saved</span>
                    )}
                  </div>
                  <div className="config-field">
                    <label>Restaurant ID</label>
                    <input
                      type="text"
                      placeholder="Enter restaurant ID from partner dashboard"
                      value={form.restaurantId || ""}
                      onChange={(e) =>
                        handleFieldChange(
                          platform.key,
                          "restaurantId",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="config-field">
                    <label>Webhook Secret</label>
                    <input
                      type="password"
                      placeholder={
                        config.hasWebhookSecret
                          ? "••••••••  (saved — leave blank to keep)"
                          : "Enter webhook secret for signature verification"
                      }
                      value={form.webhookSecret || ""}
                      onChange={(e) =>
                        handleFieldChange(
                          platform.key,
                          "webhookSecret",
                          e.target.value,
                        )
                      }
                      autoComplete="off"
                    />
                    {config.hasWebhookSecret && (
                      <span className="field-status saved">✓ Saved</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Settings Section */}
              <div className="config-section">
                <h4>⚙️ Settings</h4>
                <div className="config-settings">
                  <label className="setting-checkbox">
                    <input
                      type="checkbox"
                      checked={form.autoAcceptOrders || false}
                      onChange={(e) =>
                        handleFieldChange(
                          platform.key,
                          "autoAcceptOrders",
                          e.target.checked,
                        )
                      }
                    />
                    Auto-accept incoming orders
                  </label>
                  <label className="setting-checkbox">
                    <input
                      type="checkbox"
                      checked={form.statusUpdateEnabled !== false}
                      onChange={(e) =>
                        handleFieldChange(
                          platform.key,
                          "statusUpdateEnabled",
                          e.target.checked,
                        )
                      }
                    />
                    Send order status updates to platform
                  </label>
                  <div className="config-field inline">
                    <label>Default Prep Time (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={form.defaultPrepTime || 30}
                      onChange={(e) =>
                        handleFieldChange(
                          platform.key,
                          "defaultPrepTime",
                          parseInt(e.target.value) || 30,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="config-actions">
                <button
                  className="btn-save"
                  onClick={() => handleSave(platform.key)}
                  disabled={saving[platform.key]}
                >
                  {saving[platform.key] ? "Saving..." : "💾 Save Configuration"}
                </button>
                <button
                  className="btn-test"
                  onClick={() => handleTestConnection(platform.key)}
                  disabled={testing[platform.key]}
                >
                  {testing[platform.key] ? "Testing..." : "🔌 Test Connection"}
                </button>
              </div>

              {/* Success / Error Messages */}
              {successMsg[platform.key] && (
                <div className="config-message success">
                  ✅ {successMsg[platform.key]}
                </div>
              )}
              {errorMsg[platform.key] && (
                <div className="config-message error">
                  ❌ {errorMsg[platform.key]}
                </div>
              )}

              {/* Test Results */}
              {result && (
                <div className={`test-results ${result.overallStatus}`}>
                  <div className="test-results-header">
                    <span className="test-overall-icon">
                      {getStatusIcon(result.overallStatus)}
                    </span>
                    <span
                      className="test-overall-text"
                      style={{ color: getStatusColor(result.overallStatus) }}
                    >
                      {result.overallStatus === "pass"
                        ? "All checks passed"
                        : result.overallStatus === "warning"
                        ? "Passed with warnings"
                        : "Some checks failed"}
                    </span>
                  </div>
                  <div className="test-checks">
                    {(result.checks || []).map((check, idx) => (
                      <div key={idx} className={`test-check ${check.status}`}>
                        <span className="check-icon">
                          {getStatusIcon(check.status)}
                        </span>
                        <div className="check-details">
                          <span className="check-name">{check.name}</span>
                          <span className="check-message">{check.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlatformConfigManager;
