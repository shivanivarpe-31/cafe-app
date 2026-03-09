/**
 * Integration Statistics Dashboard
 * Displays real-time statistics and metrics for platform integrations
 */

import React, { useState, useContext, useEffect } from "react";
import IntegrationContext from "../context/IntegrationContext";
import "./IntegrationDashboard.css";

const IntegrationDashboard = () => {
  const { stats, loadStats } = useContext(IntegrationContext);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh stats every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadStats]);

  // eslint-disable-next-line no-unused-vars
  const getWebhookStatusColor = (status) => {
    switch (status) {
      case "SUCCESS":
        return "#27ae60";
      case "FAILED":
        return "#e74c3c";
      case "PENDING":
        return "#f39c12";
      default:
        return "#95a5a6";
    }
  };

  return (
    <div className="integration-dashboard">
      <div className="dashboard-header">
        <h2>📊 Integration Dashboard</h2>
        <div className="header-actions">
          <button
            className={`refresh-btn ${autoRefresh ? "active" : ""}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={
              autoRefresh ? "Auto-refresh enabled" : "Auto-refresh disabled"
            }
          >
            {autoRefresh ? "🔄 Auto-Refresh ON" : "⏸️ Auto-Refresh OFF"}
          </button>
          <button className="refresh-btn" onClick={loadStats}>
            🔃 Refresh Now
          </button>
        </div>
      </div>

      {stats ? (
        <>
          {/* Mappings Section */}
          <div className="dashboard-section">
            <h3>🗺️ Menu Item Mappings</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">📋</div>
                <div className="metric-content">
                  <div className="metric-label">Total Mappings</div>
                  <div className="metric-value">
                    {stats.mappings?.total || 0}
                  </div>
                </div>
              </div>

              <div className="metric-card swiggy">
                <div className="metric-icon">🍔</div>
                <div className="metric-content">
                  <div className="metric-label">Swiggy Mappings</div>
                  <div className="metric-value">
                    {stats.mappings?.byPlatform?.swiggy || 0}
                  </div>
                </div>
              </div>

              <div className="metric-card zomato">
                <div className="metric-icon">🍕</div>
                <div className="metric-content">
                  <div className="metric-label">Zomato Mappings</div>
                  <div className="metric-value">
                    {stats.mappings?.byPlatform?.zomato || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Webhooks Section */}
          <div className="dashboard-section">
            <h3>🪝 Webhook Statistics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">📨</div>
                <div className="metric-content">
                  <div className="metric-label">Total Webhooks</div>
                  <div className="metric-value">
                    {stats.webhooks?.total || 0}
                  </div>
                </div>
              </div>

              <div className="metric-card success">
                <div className="metric-icon">✅</div>
                <div className="metric-content">
                  <div className="metric-label">Successful</div>
                  <div className="metric-value">
                    {stats.webhooks?.byStatus?.success || 0}
                  </div>
                </div>
              </div>

              <div className="metric-card danger">
                <div className="metric-icon">❌</div>
                <div className="metric-content">
                  <div className="metric-label">Failed</div>
                  <div className="metric-value">
                    {stats.webhooks?.byStatus?.failed || 0}
                  </div>
                </div>
              </div>

              <div className="metric-card warning">
                <div className="metric-icon">⏳</div>
                <div className="metric-content">
                  <div className="metric-label">Pending</div>
                  <div className="metric-value">
                    {stats.webhooks?.byStatus?.pending || 0}
                  </div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">📅</div>
                <div className="metric-content">
                  <div className="metric-label">Last 24 Hours</div>
                  <div className="metric-value">
                    {stats.webhooks?.last24Hours || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="success-rate-container">
              <h4>Success Rate</h4>
              {stats.webhooks?.total > 0 ? (
                <>
                  <div className="progress-bar">
                    <div
                      className="progress-fill success"
                      style={{
                        width: `${
                          (stats.webhooks.byStatus.success /
                            stats.webhooks.total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="rate-text">
                    {(
                      (stats.webhooks.byStatus.success / stats.webhooks.total) *
                      100
                    ).toFixed(1)}
                    % ({stats.webhooks.byStatus.success}/{stats.webhooks.total})
                  </div>
                </>
              ) : (
                <div className="no-data">No webhook data yet</div>
              )}
            </div>
          </div>

          {/* Orders Section */}
          <div className="dashboard-section">
            <h3>🛒 Platform Orders</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">📦</div>
                <div className="metric-content">
                  <div className="metric-label">Total from Platforms</div>
                  <div className="metric-value">
                    {stats.orders?.fromPlatforms || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Health Status */}
          <div className="dashboard-section health-section">
            <h3>🏥 System Health</h3>
            <div className="health-grid">
              <div className="health-item">
                <div className="health-status good">●</div>
                <div className="health-label">Mappings Coverage</div>
                <div className="health-value">
                  {stats.mappings?.total > 0 ? "Good" : "Pending"}
                </div>
              </div>

              <div className="health-item">
                <div
                  className={`health-status ${
                    stats.webhooks?.byStatus?.failed > 0 ? "warning" : "good"
                  }`}
                >
                  ●
                </div>
                <div className="health-label">Webhook Success</div>
                <div className="health-value">
                  {stats.webhooks?.total > 0 &&
                  stats.webhooks?.byStatus?.success / stats.webhooks?.total >
                    0.99
                    ? "Excellent"
                    : "Review"}
                </div>
              </div>

              <div className="health-item">
                <div
                  className={`health-status ${
                    stats.webhooks?.byStatus?.pending > 20 ? "warning" : "good"
                  }`}
                >
                  ●
                </div>
                <div className="health-label">Queue Status</div>
                <div className="health-value">
                  {stats.webhooks?.byStatus?.pending > 20
                    ? "Backlog"
                    : "Healthy"}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-row">
              <span className="stat-key">Last Refreshed:</span>
              <span className="stat-val">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-key">Auto-Refresh:</span>
              <span className="stat-val">
                {autoRefresh ? "Every 30s" : "Disabled"}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="loading-state">
          <div className="spinner">⟳</div>
          <p>Loading statistics...</p>
        </div>
      )}
    </div>
  );
};

export default IntegrationDashboard;
