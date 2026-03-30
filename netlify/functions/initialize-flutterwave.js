const crypto = require("crypto");
const { getDocument, setDocument } = require("./_lib/firebase");
const {
  flutterwaveRequest,
  normalizeCurrency,
  parseAmount,
} = require("./_lib/flutterwave");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function getSiteOrigin(headers = {}) {
  const protocolHeader = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"];
  const hostHeader = headers["x-forwarded-host"] || headers["host"] || headers["Host"];
  const protocol = String(protocolHeader || "https").split(",")[0].trim();
  const host = String(hostHeader || "").split(",")[0].trim();

  if (!host) {
    throw new Error("Unable to determine site URL for Flutterwave redirect.");
  }

  return `${protocol}://${host}`;
}

function createTxRef(bookId, userId) {
  const safeBookId = String(bookId || "book").replace(/[^a-zA-Z0-9_-]/g, "");
  const safeUserId = String(userId || "reader").replace(/[^a-zA-Z0-9_-]/g, "");
  const randomPart = crypto.randomBytes(6).toString("hex");
  return `flw_${safeBookId}_${safeUserId}_${Date.now()}_${randomPart}`;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      bookId,
      userId,
      customerEmail,
      customerName,
    } = body;

    if (!bookId || !userId || !customerEmail) {
      return json(400, {
        error: "bookId, userId, and customerEmail are required.",
      });
    }

    const book = await getDocument("books", bookId);
    if (!book || !book.published) {
      return json(404, { error: "This book is not available for purchase." });
    }

    if (book.type !== "paid") {
      return json(400, { error: "This book does not require payment." });
    }

    const amount = parseAmount(book.price);
    const currency = normalizeCurrency(book.currency);
    const txRef = createTxRef(bookId, userId);
    const timestamp = new Date().toISOString();
    const redirectUrl = `${getSiteOrigin(event.headers)}/index.html?payment=flutterwave`;

    await setDocument("checkoutSessions", txRef, {
      txRef,
      bookId,
      bookTitle: book.title || "",
      userId,
      userEmail: String(customerEmail).trim(),
      customerName: String(customerName || "").trim(),
      amount: String(amount),
      currency,
      status: "initialized",
      provider: "flutterwave",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const flutterwaveResponse = await flutterwaveRequest("/payments", {
      method: "POST",
      body: {
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: redirectUrl,
        customer: {
          email: String(customerEmail).trim(),
          name: String(customerName || customerEmail).trim(),
        },
        customizations: {
          title: process.env.APP_SITE_NAME || "Digital Library",
          description: `Payment for ${book.title || "book access"}`,
        },
        meta: {
          bookId,
          userId,
        },
      },
    });

    const paymentLink = flutterwaveResponse?.data?.link;
    if (!paymentLink) {
      throw new Error("Flutterwave did not return a checkout link.");
    }

    await setDocument("checkoutSessions", txRef, {
      txRef,
      bookId,
      bookTitle: book.title || "",
      userId,
      userEmail: String(customerEmail).trim(),
      customerName: String(customerName || "").trim(),
      amount: String(amount),
      currency,
      status: "pending_checkout",
      provider: "flutterwave",
      paymentLink,
      createdAt: timestamp,
      updatedAt: new Date().toISOString(),
    });

    return json(200, {
      link: paymentLink,
      txRef,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Unable to initialize Flutterwave payment.",
    });
  }
};
