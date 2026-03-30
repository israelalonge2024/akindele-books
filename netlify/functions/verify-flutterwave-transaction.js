const { verifyAndStoreTransaction } = require("./_lib/flutterwave");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const purchase = await verifyAndStoreTransaction({
      txRef: body.txRef,
      transactionId: body.transactionId,
    });

    return json(200, {
      success: true,
      purchase,
    });
  } catch (error) {
    return json(400, {
      error: error.message || "Unable to verify Flutterwave transaction.",
    });
  }
};
