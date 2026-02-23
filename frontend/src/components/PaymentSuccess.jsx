import React from "react";
import { CheckCircle, Printer } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import config from "../config/businessConfig";

const PaymentSuccess = ({ isOpen, onClose, order, paymentId }) => {
  const focusTrapRef = useFocusTrap(isOpen, onClose);
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Bill #${order.billNumber || ""}</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
            h1 { text-align: center; margin-bottom: 5px; font-size: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 8px 4px; text-align: left; }
            th { border-bottom: 1px solid #000; font-weight: bold; }
            .item-row { border-bottom: 1px dashed #ccc; }
            .totals { border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #000; margin-top: 5px; padding-top: 5px; }
            .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; }
            .info { font-size: 12px; margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🍽️ ${config.restaurant.name}</h1>
            <div class="info">${config.restaurant.address}</div>
            <div class="info">Phone: ${config.restaurant.phone}</div>
          </div>

          <div class="info"><strong>Bill No:</strong> ${
            order.billNumber || ""
          }</div>
          <div class="info"><strong>Table:</strong> ${
            order.table?.number || order.orderType || "N/A"
          }</div>
          <div class="info"><strong>Date:</strong> ${new Date(
            order.createdAt,
          ).toLocaleString()}</div>
          <div class="info"><strong>Payment:</strong> ${
            order.paymentMode?.toUpperCase() || "PENDING"
          }</div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || [])
                .map(
                  (item) => `
                <tr class="item-row">
                  <td>${item.menuItem?.name || "Item"}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">₹${Number(item.price).toFixed(
                    2,
                  )}</td>
                  <td style="text-align: right;">₹${(
                    Number(item.price) * item.quantity
                  ).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row"><span>Subtotal:</span><span>₹${Number(
              order.subtotal,
            ).toFixed(2)}</span></div>
            <div class="total-row"><span>${config.tax.label}:</span><span>${
      config.currency.symbol
    }${Number(order.tax).toFixed(2)}</span></div>
            <div class="total-row grand-total"><span>TOTAL:</span><span>₹${Number(
              order.total,
            ).toFixed(2)}</span></div>
          </div>

          <div class="footer">
            <p>Thank you for visiting!</p>
            <p>Please come again</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Detect split payment
  const isSplitPayment = order.paymentMode?.includes("+");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Payment successful"
        tabIndex={-1}
      >
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        {/* Success Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h2>
        <p className="text-gray-600 mb-6">Thank you for your payment</p>

        {/* Payment Details */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Bill Number</span>
            <span className="font-semibold text-gray-900">
              {order.billNumber}
            </span>
          </div>

          {isSplitPayment ? (
            /* Split Payment Details */
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Payment Type</span>
                <span className="font-semibold text-orange-600">
                  Split Payment
                </span>
              </div>
              {order.payments && order.payments.length > 0 ? (
                <>
                  {order.payments.map((payment, idx) => (
                    <div
                      key={payment.id || idx}
                      className="flex justify-between items-center mb-2 pl-4"
                    >
                      <span className="text-sm text-gray-600">
                        {payment.paymentMode}
                      </span>
                      <span className="font-medium text-gray-700">
                        ₹{parseFloat(payment.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-900">
                      Total Paid
                    </span>
                    <span className="font-bold text-green-600">
                      ₹{parseFloat(order.total).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">
                      Payment Methods
                    </span>
                    <span className="font-medium text-gray-700">
                      {order.paymentMode}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Amount Paid</span>
                    <span className="font-bold text-green-600">
                      ₹{parseFloat(order.total).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Single Payment Details */
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Amount Paid</span>
                <span className="font-bold text-green-600">
                  ₹{parseFloat(order.total).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Payment Mode</span>
                <span className="font-medium text-gray-700">
                  {order.paymentMode}
                </span>
              </div>
            </>
          )}

          {paymentId && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Transaction ID</span>
              <span className="font-mono text-xs text-gray-700">
                {paymentId}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center justify-center space-x-2"
          >
            <Printer className="w-5 h-5" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
