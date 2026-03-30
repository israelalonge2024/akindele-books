exports.handler = async function handler() {
  return {
    statusCode: 501,
    body: JSON.stringify({
      error: "Stripe webhook verification is not connected yet.",
      nextStep:
        "Verify the Stripe signature here and write a trusted purchase record into Firebase after payment succeeds.",
    }),
  };
};
