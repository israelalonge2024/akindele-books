const { getDocument } = require("./_lib/firebase");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function parseJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const localId = String(body.localId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const idToken = String(body.idToken || "").trim();

    if (!localId || !email || !idToken) {
      return json(400, { error: "localId, email, and idToken are required." });
    }

    const tokenPayload = parseJwtPayload(idToken);
    const tokenUserId = String(tokenPayload?.user_id || tokenPayload?.sub || "").trim();
    const tokenEmail = String(tokenPayload?.email || "").trim().toLowerCase();

    if ((tokenUserId && tokenUserId !== localId) || (tokenEmail && tokenEmail !== email)) {
      return json(403, { error: "The provided session does not match the requested user." });
    }

    if (tokenPayload?.admin === true || tokenPayload?.role === "admin") {
      return json(200, { isAdmin: true, source: "token" });
    }

    const user = await getDocument("users", localId);
    const isAdmin = user?.role === "admin" || user?.admin === true;

    return json(200, {
      isAdmin: Boolean(isAdmin),
      source: "firestore",
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Unable to verify admin access.",
    });
  }
};
