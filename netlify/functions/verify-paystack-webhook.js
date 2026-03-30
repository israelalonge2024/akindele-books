exports.handler = async function handler() {
  return {
    statusCode: 501,
    body: JSON.stringify({
      error: "Paystack webhook verification is not connected yet.",
      nextStep:
        "Verify the Paystack event here and write a trusted purchase record into Firebase after payment succeeds.",
    }),
  };
};
