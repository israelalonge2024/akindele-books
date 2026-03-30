const crypto = require("crypto");

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getFirebaseProjectId() {
  return requireEnv("FIREBASE_PROJECT_ID");
}

function getFirebaseClientEmail() {
  return requireEnv("FIREBASE_CLIENT_EMAIL");
}

function getFirebasePrivateKey() {
  return requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function getFirestoreBaseUrl() {
  const projectId = getFirebaseProjectId();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSignedJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = encodeBase64Url(
    JSON.stringify({
      iss: getFirebaseClientEmail(),
      scope: FIRESTORE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claimSet}`);
  signer.end();
  const signature = signer.sign(getFirebasePrivateKey());
  return `${header}.${claimSet}.${encodeBase64Url(signature)}`;
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry - 60000) {
    return cachedAccessToken;
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createSignedJwt(),
    }).toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Unable to get Firebase access token.");
  }

  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: toFirestoreFields(value),
      },
    };
  }

  return { stringValue: String(value) };
}

function toFirestoreFields(data) {
  return Object.entries(data).reduce((fields, [key, value]) => {
    fields[key] = toFirestoreValue(value);
    return fields;
  }, {});
}

function fromFirestoreValue(field) {
  if (!field || typeof field !== "object") {
    return null;
  }

  if ("stringValue" in field) {
    return field.stringValue;
  }

  if ("booleanValue" in field) {
    return field.booleanValue;
  }

  if ("integerValue" in field) {
    return Number(field.integerValue);
  }

  if ("doubleValue" in field) {
    return Number(field.doubleValue);
  }

  if ("timestampValue" in field) {
    return field.timestampValue;
  }

  if ("nullValue" in field) {
    return null;
  }

  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(fromFirestoreValue);
  }

  if ("mapValue" in field) {
    return fromFirestoreFields(field.mapValue.fields || {});
  }

  return null;
}

function fromFirestoreFields(fields) {
  return Object.entries(fields || {}).reduce((result, [key, value]) => {
    result[key] = fromFirestoreValue(value);
    return result;
  }, {});
}

async function firestoreRequest(path = "", options = {}) {
  const accessToken = await getAccessToken();
  const baseUrl = getFirestoreBaseUrl();
  const url = path ? `${baseUrl}/${path}` : baseUrl;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 404) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Firestore request failed.");
  }

  return data;
}

function buildDocumentPath(collectionName, documentId) {
  return `${collectionName}/${encodeURIComponent(documentId)}`;
}

async function getDocument(collectionName, documentId) {
  const data = await firestoreRequest(buildDocumentPath(collectionName, documentId));
  if (!data) {
    return null;
  }

  return {
    id: data.name.split("/").pop(),
    ...fromFirestoreFields(data.fields || {}),
  };
}

async function setDocument(collectionName, documentId, value) {
  const data = await firestoreRequest(buildDocumentPath(collectionName, documentId), {
    method: "PATCH",
    body: {
      fields: toFirestoreFields(value),
    },
  });

  return {
    id: data.name.split("/").pop(),
    ...fromFirestoreFields(data.fields || {}),
  };
}

async function deleteDocument(collectionName, documentId) {
  await firestoreRequest(buildDocumentPath(collectionName, documentId), {
    method: "DELETE",
  });
}

module.exports = {
  deleteDocument,
  fromFirestoreFields,
  getDocument,
  getFirebaseProjectId,
  requireEnv,
  setDocument,
  toFirestoreFields,
};
