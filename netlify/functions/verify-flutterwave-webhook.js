const crypto = require("crypto");
const { getFlutterwaveSecretHash, verifyAndStoreTransaction } = require("./_lib/flutterwave");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function getWebhookSignature(headers = {}) {
  return (
    headers["verif-hash"] ||
    headers["Verif-Hash"] ||
    headers["flutterwave-signature"] ||
    headers["Flutterwave-Signature"] ||
    ""
  );
}

function isValidWebhookSignature(rawBody, signature, secretHash) {
  if (!signature || !secretHash) {
    return false;
  }

  if (signature === secretHash) {
    return true;
  }

  const computedHash = crypto
    .createHmac("sha256", secretHash)
    .update(rawBody || "")
    .digest("base64");

  return computedHash === signature;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const signature = String(getWebhookSignature(event.headers)).trim();
    const expectedSignature = String(getFlutterwaveSecretHash()).trim();

    if (!isValidWebhookSignature(event.body || "", signature, expectedSignature)) {
      return json(401, { error: "Invalid Flutterwave webhook signature." });
    }

    const body = JSON.parse(event.body || "{}");
    const data = body?.data || {};
    const txRef = data?.tx_ref;
    const transactionId = data?.id;
    const status = String(data?.status || "").toLowerCase();

    if (!txRef || !transactionId) {
      return json(200, { received: true, skipped: true });
    }

    if (status && status !== "successful") {
      return json(200, { received: true, skipped: true });
    }

    const purchase = await verifyAndStoreTransaction({
      txRef,
      transactionId,
    });

    return json(200, {
      received: true,
      purchase,
    });
  } catch (error) {
    return json(400, {
      error: error.message || "Unable to process Flutterwave webhook.",
    });
  }
};
