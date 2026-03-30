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
      error: "Paystack initialization is not connected yet.",
      nextStep:
        "Add PAYSTACK_SECRET_KEY, transaction initialization logic, callback verification, and Firebase purchase-write verification.",
    }),
  };
};
