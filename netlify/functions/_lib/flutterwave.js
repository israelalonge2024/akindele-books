const { getDocument, setDocument, requireEnv } = require("./firebase");

const FLUTTERWAVE_API_URL = "https://api.flutterwave.com/v3";

function getFlutterwaveSecretKey() {
  return requireEnv("FLUTTERWAVE_SECRET_KEY");
}

function getFlutterwaveSecretHash() {
  return requireEnv("FLUTTERWAVE_SECRET_HASH");
}

async function flutterwaveRequest(path, options = {}) {
  const response = await fetch(`${FLUTTERWAVE_API_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Flutterwave request failed.");
  }

  return data;
}

function parseAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error("Book price is invalid for payment.");
  }

  return Number(numericValue.toFixed(2));
}

function normalizeCurrency(value) {
  return String(value || "USD").trim().toUpperCase();
}

async function verifyAndStoreTransaction({ txRef, transactionId }) {
  if (!txRef || !transactionId) {
    throw new Error("Missing Flutterwave verification values.");
  }

  const checkoutSession = await getDocument("checkoutSessions", txRef);
  if (!checkoutSession) {
    throw new Error("Checkout session not found.");
  }

  const verification = await flutterwaveRequest(`/transactions/${encodeURIComponent(transactionId)}/verify`);
  const transaction = verification.data || {};
  const expectedAmount = parseAmount(checkoutSession.amount);
  const expectedCurrency = normalizeCurrency(checkoutSession.currency);
  const paidAmount = Number(transaction.amount || 0);
  const paidCurrency = normalizeCurrency(transaction.currency);

  if (String(transaction.tx_ref || "") !== String(txRef)) {
    throw new Error("Flutterwave transaction reference does not match.");
  }

  if (String(transaction.status || "").toLowerCase() !== "successful") {
    throw new Error("Flutterwave payment is not successful.");
  }

  if (!Number.isFinite(paidAmount) || paidAmount < expectedAmount) {
    throw new Error("Flutterwave payment amount does not match the book price.");
  }

  if (paidCurrency !== expectedCurrency) {
    throw new Error("Flutterwave payment currency does not match the book currency.");
  }

  const timestamp = new Date().toISOString();
  const purchaseRecord = {
    bookId: checkoutSession.bookId,
    bookTitle: checkoutSession.bookTitle || "",
    userId: checkoutSession.userId,
    userEmail: checkoutSession.userEmail,
    customerName: checkoutSession.customerName || "",
    amount: String(expectedAmount),
    currency: expectedCurrency,
    status: "paid",
    provider: "flutterwave",
    txRef,
    transactionId: String(transaction.id || transactionId),
    paymentStatus: String(transaction.status || ""),
    createdAt: checkoutSession.createdAt || timestamp,
    verifiedAt: timestamp,
  };

  await setDocument("purchases", txRef, purchaseRecord);
  await setDocument("checkoutSessions", txRef, {
    ...checkoutSession,
    status: "verified",
    transactionId: purchaseRecord.transactionId,
    paymentStatus: purchaseRecord.paymentStatus,
    verifiedAt: timestamp,
    updatedAt: timestamp,
  });

  return purchaseRecord;
}

module.exports = {
  flutterwaveRequest,
  getFlutterwaveSecretHash,
  normalizeCurrency,
  parseAmount,
  verifyAndStoreTransaction,
};
