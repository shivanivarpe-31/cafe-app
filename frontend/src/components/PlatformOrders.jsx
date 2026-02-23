/**
 * Platform Orders Component
 * Displays orders coming from Swiggy and Zomato platforms
 */

import React, { useState, useEffect } from "react";
import { apiCall } from "../utils/api";
import "./PlatformOrders.css";

const PlatformOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState(null);

  // Fetch platform orders
  useEffect(() => {
    const abortController = new AbortController();

    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint =
          filter === "ALL"
            ? "/orders?source=platform"
            : `/orders?platform=${filter}&source=platform`;
        const response = await apiCall(endpoint, {
          signal: abortController.signal,
        });
        setOrders(response.orders || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError("Failed to load platform orders: " + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Refresh every 10 seconds
    return () => {
      clearInterval(interval);
      abortController.abort();
    };
  }, [filter]);

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#f39c12";
      case "CONFIRMED":
        return "#3498db";
      case "IN_PROGRESS":
        return "#9b59b6";
      case "READY":
        return "#1abc9c";
      case "COMPLETED":
        return "#27ae60";
      case "CANCELLED":
        return "#e74c3c";
      default:
        return "#95a5a6";
    }
  };

  const getPlatformColor = (platform) => {
    return platform === "SWIGGY" ? "#ff6b35" : "#e74c3c";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "PENDING":
        return "⏳";
      case "CONFIRMED":
        return "✅";
      case "IN_PROGRESS":
        return "👨‍🍳";
      case "READY":
        return "🍕";
      case "COMPLETED":
        return "🎉";
      case "CANCELLED":
        return "❌";
      default:
        return "❓";
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === "ALL") return true;
    return o.platform === filter;
  });

  return (
    <div className="platform-orders-container">
      <div className="orders-header">
        <h2>🛒 Platform Orders</h2>
        <p className="subtitle">Real-time orders from Swiggy & Zomato</p>
      </div>

      {/* Error Message */}
      {error && <div className="error-message">⚠️ {error}</div>}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {["ALL", "SWIGGY", "ZOMATO"].map((platform) => (
          <button
            key={platform}
            className={`filter-tab ${filter === platform ? "active" : ""}`}
            onClick={() => setFilter(platform)}
          >
            {platform === "SWIGGY" && "🍔"}
            {platform === "ZOMATO" && "🍕"}
            {platform === "ALL" && "📋"} {platform} (
            {
              filteredOrders.filter(
                (o) => o.platform === platform || platform === "ALL",
              ).length
            }
            )
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner">⟳</div>
          <p>Loading orders...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <>
          {/* Orders Grid */}
          <div className="orders-grid">
            {filteredOrders.map((order) => (
              <button
                type="button"
                key={order.id}
                className="order-card"
                aria-label={`${order.platform} order #${order.id}`}
                onClick={() =>
                  setSelectedOrder(
                    selectedOrder?.id === order.id ? null : order,
                  )
                }
              >
                {/* Order Header */}
                <div className="order-header-row">
                  <div className="order-id">
                    <span
                      className="platform-badge"
                      style={{ background: getPlatformColor(order.platform) }}
                    >
                      {order.platform === "SWIGGY" ? "🍔" : "🍕"}{" "}
                      {order.platform}
                    </span>
                    <span className="order-number">#{order.id}</span>
                  </div>
                  <div
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {getStatusIcon(order.status)} {order.status}
                  </div>
                </div>

                {/* Order Details */}
                <div className="order-details">
                  <div className="detail-row">
                    <span className="detail-label">Customer</span>
                    <span className="detail-value">
                      {order.customerName || "N/A"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Items</span>
                    <span className="detail-value">
                      {order.items?.length || 0} items
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Total</span>
                    <span className="detail-value">
                      ₹{order.total?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time</span>
                    <span className="detail-value">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Expand Indicator */}
                <div
                  className={`expand-indicator ${
                    selectedOrder?.id === order.id ? "expanded" : ""
                  }`}
                >
                  ⋮
                </div>
              </button>
            ))}
          </div>

          {/* Selected Order Details */}
          {selectedOrder && (
            <div className="order-details-modal">
              <div className="modal-header">
                <h3>Order Details - #{selectedOrder.id}</h3>
                <button
                  className="close-btn"
                  onClick={() => setSelectedOrder(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                {/* Basic Info */}
                <div className="info-section">
                  <h4>📋 Basic Information</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Platform</span>
                      <span
                        className="value"
                        style={{
                          color: getPlatformColor(selectedOrder.platform),
                        }}
                      >
                        {selectedOrder.platform === "SWIGGY" ? "🍔" : "🍕"}{" "}
                        {selectedOrder.platform}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">Status</span>
                      <span
                        className="value"
                        style={{ color: getStatusColor(selectedOrder.status) }}
                      >
                        {getStatusIcon(selectedOrder.status)}{" "}
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">Customer</span>
                      <span className="value">
                        {selectedOrder.customerName}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">Phone</span>
                      <span className="value">
                        {selectedOrder.customerPhone}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="info-section">
                  <h4>📍 Delivery Address</h4>
                  <div className="address">{selectedOrder.deliveryAddress}</div>
                </div>

                {/* Items */}
                <div className="info-section">
                  <h4>🛍️ Items</h4>
                  <div className="items-list">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="item-row">
                        <div className="item-name">{item.name}</div>
                        <div className="item-qty">x{item.quantity}</div>
                        <div className="item-price">
                          ₹{item.price?.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="info-section">
                  <h4>💰 Payment Details</h4>
                  <div className="totals">
                    <div className="total-row">
                      <span>Subtotal</span>
                      <span>₹{(selectedOrder.subTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>Delivery Fee</span>
                      <span>
                        ₹{(selectedOrder.deliveryFee || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="total-row">
                      <span>Tax</span>
                      <span>₹{(selectedOrder.tax || 0).toFixed(2)}</span>
                    </div>
                    <div className="total-row final">
                      <span>Total Amount</span>
                      <span>₹{selectedOrder.total?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="info-section">
                  <h4>⏱️ Timeline</h4>
                  <div className="timeline">
                    <div className="timeline-item">
                      <div className="timeline-time">
                        {new Date(selectedOrder.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="timeline-label">Order Created</div>
                    </div>
                    {selectedOrder.confirmedAt && (
                      <div className="timeline-item">
                        <div className="timeline-time">
                          {new Date(
                            selectedOrder.confirmedAt,
                          ).toLocaleTimeString()}
                        </div>
                        <div className="timeline-label">Order Confirmed</div>
                      </div>
                    )}
                    {selectedOrder.completedAt && (
                      <div className="timeline-item">
                        <div className="timeline-time">
                          {new Date(
                            selectedOrder.completedAt,
                          ).toLocaleTimeString()}
                        </div>
                        <div className="timeline-label">Order Completed</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No orders from platforms yet</p>
          <p className="empty-subtitle">
            Orders will appear here once you receive them
          </p>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="auto-refresh-indicator">
        🔄 Auto-refreshing every 10 seconds
      </div>
    </div>
  );
};

export default PlatformOrders;
