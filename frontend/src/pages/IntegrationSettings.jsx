/**
 * Integration Settings Page
 * Main hub for managing Swiggy & Zomato integration
 */

import React, { useState } from "react";
import IntegrationDashboard from "../components/IntegrationDashboard";
import ItemMappingManager from "../components/ItemMappingManager";
import "./IntegrationSettings.css";
import Navbar from "../components/navbar";

const IntegrationSettings = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="integration-settings-page">
        {/* Tab Navigation */}
        <div className="integration-tabs">
          <button
            className={`tab-button ${
              activeTab === "dashboard" ? "active" : ""
            }`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span className="tab-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`tab-button ${activeTab === "mappings" ? "active" : ""}`}
            onClick={() => setActiveTab("mappings")}
          >
            <span className="tab-icon">🗺️</span>
            Item Mappings
          </button>
          <button
            className={`tab-button ${activeTab === "webhooks" ? "active" : ""}`}
            onClick={() => setActiveTab("webhooks")}
          >
            <span className="tab-icon">🪝</span>
            Webhooks
          </button>
          <button
            className={`tab-button ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => setActiveTab("docs")}
          >
            <span className="tab-icon">📚</span>
            Documentation
          </button>
        </div>

        {/* Tab Content */}
        <div className="integration-tab-content">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="tab-pane active">
              <IntegrationDashboard />
            </div>
          )}

          {/* Mappings Tab */}
          {activeTab === "mappings" && (
            <div className="tab-pane active">
              <ItemMappingManager />
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="tab-pane active">
              <div className="webhooks-container">
                <div className="webhooks-header">
                  <h2>🪝 Webhook Configuration</h2>
                  <p>
                    Configure and monitor webhook endpoints for real-time order
                    processing
                  </p>
                </div>

                <div className="webhook-info-cards">
                  <div className="webhook-card swiggy">
                    <div className="webhook-platform">🍔 Swiggy Webhook</div>
                    <div className="webhook-endpoint">
                      <div className="label">Endpoint</div>
                      <div className="value">/delivery/webhook/swiggy</div>
                    </div>
                    <div className="webhook-method">
                      <div className="label">Method</div>
                      <div className="value">POST</div>
                    </div>
                    <div className="webhook-status">
                      <div className="label">Status</div>
                      <div className="value status-active">🟢 Active</div>
                    </div>
                    <div className="webhook-description">
                      Receives real-time order events from Swiggy platform
                    </div>
                  </div>

                  <div className="webhook-card zomato">
                    <div className="webhook-platform">🍕 Zomato Webhook</div>
                    <div className="webhook-endpoint">
                      <div className="label">Endpoint</div>
                      <div className="value">/delivery/webhook/zomato</div>
                    </div>
                    <div className="webhook-method">
                      <div className="label">Method</div>
                      <div className="value">POST</div>
                    </div>
                    <div className="webhook-status">
                      <div className="label">Status</div>
                      <div className="value status-active">🟢 Active</div>
                    </div>
                    <div className="webhook-description">
                      Receives real-time order events from Zomato platform
                    </div>
                  </div>
                </div>

                <div className="webhook-setup">
                  <h3>📋 Setup Instructions</h3>
                  <ol>
                    <li>
                      <strong>Get Webhook Secrets</strong>
                      <p>
                        Obtain webhook secrets from Swiggy and Zomato partner
                        dashboards
                      </p>
                    </li>
                    <li>
                      <strong>Configure Environment</strong>
                      <p>Add secrets to .env.production:</p>
                      <pre>{`SWIGGY_WEBHOOK_SECRET=your_swiggy_secret
ZOMATO_WEBHOOK_SECRET=your_zomato_secret`}</pre>
                    </li>
                    <li>
                      <strong>Register Webhooks</strong>
                      <p>Register the endpoints in platform dashboards:</p>
                      <pre>{`https://your-app.com/delivery/webhook/swiggy
https://your-app.com/delivery/webhook/zomato`}</pre>
                    </li>
                    <li>
                      <strong>Test Webhooks</strong>
                      <p>
                        Use platform testing tools or curl to verify signature
                        verification
                      </p>
                    </li>
                  </ol>
                </div>

                <div className="webhook-security">
                  <h3>🔐 Security Features</h3>
                  <ul>
                    <li>✅ HMAC-SHA256 signature verification</li>
                    <li>✅ Timing-safe signature comparison</li>
                    <li>✅ Raw body middleware for accurate verification</li>
                    <li>✅ Comprehensive error logging</li>
                    <li>✅ Automatic retry with exponential backoff</li>
                    <li>✅ Idempotency checking to prevent duplicates</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Documentation Tab */}
          {activeTab === "docs" && (
            <div className="tab-pane active">
              <div className="docs-container">
                <div className="docs-header">
                  <h2>📚 Integration Documentation</h2>
                  <p>
                    Complete guides for setup, deployment, and troubleshooting
                  </p>
                </div>

                <div className="docs-grid">
                  <div className="doc-card">
                    <div className="doc-icon">⚙️</div>
                    <div className="doc-title">Configuration Guide</div>
                    <div className="doc-description">
                      Step-by-step setup instructions for webhook configuration
                      and testing
                    </div>
                    <button type="button" className="doc-link">
                      Read Guide →
                    </button>
                  </div>

                  <div className="doc-card">
                    <div className="doc-icon">🚀</div>
                    <div className="doc-title">Deployment Plan</div>
                    <div className="doc-description">
                      5-phase production deployment roadmap with validation
                      steps
                    </div>
                    <button type="button" className="doc-link">
                      View Roadmap →
                    </button>
                  </div>

                  <div className="doc-card">
                    <div className="doc-icon">🐛</div>
                    <div className="doc-title">Troubleshooting</div>
                    <div className="doc-description">
                      Common issues and solutions for webhook processing
                    </div>
                    <button type="button" className="doc-link">
                      Get Help →
                    </button>
                  </div>

                  <div className="doc-card">
                    <div className="doc-icon">💡</div>
                    <div className="doc-title">Best Practices</div>
                    <div className="doc-description">
                      Recommended patterns for item mapping and order processing
                    </div>
                    <button type="button" className="doc-link">
                      Learn More →
                    </button>
                  </div>

                  <div className="doc-card">
                    <div className="doc-icon">📊</div>
                    <div className="doc-title">API Reference</div>
                    <div className="doc-description">
                      Complete API documentation for integration endpoints
                    </div>
                    <button type="button" className="doc-link">
                      View API →
                    </button>
                  </div>

                  <div className="doc-card">
                    <div className="doc-icon">🔍</div>
                    <div className="doc-title">Monitoring</div>
                    <div className="doc-description">
                      Setup monitoring and alerts for real-time health tracking
                    </div>
                    <button type="button" className="doc-link">
                      Learn Setup →
                    </button>
                  </div>
                </div>

                <div className="faq-section">
                  <h3>❓ Frequently Asked Questions</h3>

                  <div className="faq-item">
                    <div className="faq-question">
                      How do I test webhooks locally?
                    </div>
                    <div className="faq-answer">
                      Use ngrok to expose your local server:{" "}
                      <code>ngrok http 5001</code>. Then register the ngrok URL
                      in platform dashboards for testing.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-question">
                      What happens if a webhook fails?
                    </div>
                    <div className="faq-answer">
                      Failed webhooks are automatically enqueued for retry with
                      exponential backoff (1, 2, 4, 8 minutes). Maximum 5 retry
                      attempts before manual review.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-question">
                      How do I map menu items to platforms?
                    </div>
                    <div className="faq-answer">
                      Use the "Item Mappings" tab to create mappings. You can
                      add items individually or bulk import for efficiency.
                    </div>
                  </div>

                  <div className="faq-item">
                    <div className="faq-question">
                      What if items can't be found?
                    </div>
                    <div className="faq-answer">
                      If exact mappings don't exist, the system falls back to
                      name-based matching. Ensure your menu item names are
                      similar to platform item names.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
