exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  return {
    statusCode: 501,
    body: JSON.stringify({
      error: "Stripe checkout is not connected yet.",
      nextStep:
        "Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, success URL logic, and Firebase purchase-write verification.",
    }),
  };
};
