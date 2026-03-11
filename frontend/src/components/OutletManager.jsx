import React, { useState, useEffect, useCallback } from "react";
import useIntegration from "../hooks/useIntegration";
import "./OutletManager.css";

const OutletManager = () => {
  const {
    loading,
    error,
    getOutletDeliveryStatus,
    updateOutletDeliveryStatus,
    updateDeliveryCharge,
    getOutletDeliveryTime,
    updateSurgeTime,
    getZomatoDeliveryTimings,
    updateZomatoDeliveryTimings,
    getSelfDeliveryTimings,
    updateSelfDeliveryTimings,
    getLogisticsStatus,
    updateSelfDeliveryServiceability,
  } = useIntegration();

  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [deliveryTime, setDeliveryTime] = useState(null);
  const [zomatoTimings, setZomatoTimings] = useState(null);
  const [selfTimings, setSelfTimings] = useState(null);
  const [logistics, setLogistics] = useState(null);
  const [message, setMessage] = useState(null);

  // Surge form
  const [surgeMinutes, setSurgeMinutes] = useState(15);

  // Delivery charge form
  const [chargeRows, setChargeRows] = useState([
    { min_order_value: 0, max_order_value: 200, delivery_charge: 30 },
    { min_order_value: 200, max_order_value: 500, delivery_charge: 20 },
    { min_order_value: 500, max_order_value: 99999, delivery_charge: 0 },
  ]);

  const showMsg = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Fetch all data on mount
  const loadAll = useCallback(async () => {
    try {
      const [ds, dt, zt, st, lg] = await Promise.allSettled([
        getOutletDeliveryStatus(),
        getOutletDeliveryTime(),
        getZomatoDeliveryTimings(),
        getSelfDeliveryTimings(),
        getLogisticsStatus(),
      ]);
      if (ds.status === "fulfilled") setDeliveryStatus(ds.value);
      if (dt.status === "fulfilled") setDeliveryTime(dt.value);
      if (zt.status === "fulfilled") setZomatoTimings(zt.value);
      if (st.status === "fulfilled") setSelfTimings(st.value);
      if (lg.status === "fulfilled") setLogistics(lg.value);
    } catch {
      // individual errors handled by hook
    }
  }, [
    getOutletDeliveryStatus,
    getOutletDeliveryTime,
    getZomatoDeliveryTimings,
    getSelfDeliveryTimings,
    getLogisticsStatus,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Handlers ──

  const handleToggleDelivery = async (enabled) => {
    try {
      const result = await updateOutletDeliveryStatus(enabled);
      showMsg(result.message || `Delivery ${enabled ? "enabled" : "disabled"}`);
      loadAll();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const handleUpdateCharges = async () => {
    try {
      const result = await updateDeliveryCharge(chargeRows);
      showMsg(result.message || "Delivery charges updated");
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const handleAddSurge = async () => {
    try {
      const result = await updateSurgeTime(surgeMinutes, false);
      showMsg(result.message || `Surge of ${surgeMinutes} min added`);
      loadAll();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const handleRemoveSurge = async () => {
    try {
      const result = await updateSurgeTime(0, true);
      showMsg(result.message || "Surge removed");
      loadAll();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const handleToggleSelfDelivery = async (enabled) => {
    try {
      const result = await updateSelfDeliveryServiceability(enabled);
      showMsg(
        result.message || `Self-delivery ${enabled ? "enabled" : "disabled"}`,
      );
      loadAll();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const handleUpdateZomatoTimings = async (timingsObj) => { // eslint-disable-line no-unused-vars
    try {
      const result = await updateZomatoDeliveryTimings(timingsObj);
      showMsg(result.message || "Zomato timings updated");
      loadAll();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const handleUpdateSelfTimings = async (timingsObj) => { // eslint-disable-line no-unused-vars
    try {
      const result = await updateSelfDeliveryTimings(timingsObj);
      showMsg(result.message || "Self-delivery timings updated");
      loadAll();
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  // Charge row helpers
  const updateChargeRow = (idx, field, value) => {
    setChargeRows((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [field]: parseFloat(value) || 0 } : row,
      ),
    );
  };

  const addChargeRow = () => {
    setChargeRows((prev) => [
      ...prev,
      { min_order_value: 0, max_order_value: 0, delivery_charge: 0 },
    ]);
  };

  const removeChargeRow = (idx) => {
    setChargeRows((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="outlet-manager">
      <div className="outlet-header">
        <h2>🏪 Outlet Management</h2>
        <p>Manage delivery status, charges, timings, and logistics on Zomato</p>
      </div>

      {message && (
        <div className={`outlet-msg ${message.type}`}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}
      {error && <div className="outlet-msg error">❌ {error}</div>}

      <div className="outlet-grid">
        {/* Delivery Status Card */}
        <div className="outlet-card">
          <div className="card-header">
            <span className="card-icon">🚚</span>
            <h3>Delivery Status</h3>
          </div>
          <div className="card-body">
            <div className="status-row">
              <span className="status-label">Current Status</span>
              <span
                className={`status-badge ${
                  deliveryStatus?.deliveryStatus?.delivery_enabled
                    ? "active"
                    : "inactive"
                }`}
              >
                {deliveryStatus?.deliveryStatus?.delivery_enabled
                  ? "🟢 Active"
                  : "🔴 Inactive"}
              </span>
            </div>
            <div className="status-actions">
              <button
                className="btn btn-success"
                onClick={() => handleToggleDelivery(true)}
                disabled={loading}
              >
                Enable Delivery
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleToggleDelivery(false)}
                disabled={loading}
              >
                Disable Delivery
              </button>
            </div>
          </div>
        </div>

        {/* Logistics Status Card */}
        <div className="outlet-card">
          <div className="card-header">
            <span className="card-icon">📦</span>
            <h3>Logistics Status</h3>
          </div>
          <div className="card-body">
            {logistics?.logisticsStatus ? (
              <div className="logistics-info">
                <div className="status-row">
                  <span className="status-label">Zomato Logistics</span>
                  <span
                    className={`status-badge ${
                      logistics.logisticsStatus.zomato_logistics
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    {logistics.logisticsStatus.zomato_logistics
                      ? "🟢 Available"
                      : "🔴 Unavailable"}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">Self Delivery</span>
                  <span
                    className={`status-badge ${
                      logistics.logisticsStatus.self_delivery
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    {logistics.logisticsStatus.self_delivery
                      ? "🟢 Enabled"
                      : "🔴 Disabled"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="no-data">No logistics data available</p>
            )}
            <div className="status-actions">
              <button
                className="btn btn-success"
                onClick={() => handleToggleSelfDelivery(true)}
                disabled={loading}
              >
                Enable Self-Delivery
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleToggleSelfDelivery(false)}
                disabled={loading}
              >
                Disable Self-Delivery
              </button>
            </div>
          </div>
        </div>

        {/* Surge Time Card */}
        <div className="outlet-card">
          <div className="card-header">
            <span className="card-icon">⚡</span>
            <h3>Surge Time</h3>
          </div>
          <div className="card-body">
            {deliveryTime?.deliveryTime && (
              <div className="timing-info">
                <div className="status-row">
                  <span className="status-label">Standard Time</span>
                  <span className="timing-value">
                    {deliveryTime.deliveryTime.standard_time || "—"} min
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">Current Surge</span>
                  <span className="timing-value surge">
                    +{deliveryTime.deliveryTime.surge_time || 0} min
                  </span>
                </div>
              </div>
            )}
            <div className="surge-form">
              <label>
                Surge Minutes
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={surgeMinutes}
                  onChange={(e) =>
                    setSurgeMinutes(parseInt(e.target.value) || 0)
                  }
                />
              </label>
              <div className="status-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAddSurge}
                  disabled={loading}
                >
                  Add Surge
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleRemoveSurge}
                  disabled={loading}
                >
                  Remove Surge
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Zomato Delivery Timings Card */}
        <div className="outlet-card">
          <div className="card-header">
            <span className="card-icon">🕐</span>
            <h3>Zomato Delivery Timings</h3>
          </div>
          <div className="card-body">
            {zomatoTimings?.timings ? (
              <pre className="timing-json">
                {JSON.stringify(zomatoTimings.timings, null, 2)}
              </pre>
            ) : (
              <p className="no-data">No Zomato timing data</p>
            )}
            <button
              className="btn btn-secondary"
              onClick={loadAll}
              disabled={loading}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Self-Delivery Timings Card */}
        <div className="outlet-card">
          <div className="card-header">
            <span className="card-icon">🏍️</span>
            <h3>Self-Delivery Timings</h3>
          </div>
          <div className="card-body">
            {selfTimings?.timings ? (
              <pre className="timing-json">
                {JSON.stringify(selfTimings.timings, null, 2)}
              </pre>
            ) : (
              <p className="no-data">No self-delivery timing data</p>
            )}
            <button
              className="btn btn-secondary"
              onClick={loadAll}
              disabled={loading}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Delivery Charges Section */}
      <div className="outlet-card full-width">
        <div className="card-header">
          <span className="card-icon">💰</span>
          <h3>Delivery Charges</h3>
        </div>
        <div className="card-body">
          <p className="card-desc">
            Configure delivery charges based on order value ranges. Orders
            matching a range will be charged the corresponding delivery fee.
          </p>
          <table className="charges-table">
            <thead>
              <tr>
                <th>Min Order Value (₹)</th>
                <th>Max Order Value (₹)</th>
                <th>Delivery Charge (₹)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {chargeRows.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={row.min_order_value}
                      onChange={(e) =>
                        updateChargeRow(idx, "min_order_value", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={row.max_order_value}
                      onChange={(e) =>
                        updateChargeRow(idx, "max_order_value", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={row.delivery_charge}
                      onChange={(e) =>
                        updateChargeRow(idx, "delivery_charge", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn-icon-remove"
                      onClick={() => removeChargeRow(idx)}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="charge-actions">
            <button className="btn btn-secondary" onClick={addChargeRow}>
              + Add Row
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpdateCharges}
              disabled={loading}
            >
              {loading ? "⏳ Updating..." : "💾 Save Charges"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutletManager;
