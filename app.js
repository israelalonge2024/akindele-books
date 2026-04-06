const DEFAULT_BOOKS = [
  {
    id: "still-water-between-us",
    title: "Still Water Between Us",
    author: "Nora Vale",
    description:
      "A tender contemporary novel about silence, memory, and the emotional currents that keep two lives connected.",
    category: "Literary Fiction",
    type: "free",
    price: "Free",
    currency: "USD",
    featured: true,
    published: true,
    coverUrl:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    pdfUrl: "",
    pdfFileName: "still-water-between-us.pdf",
    createdAt: "2026-03-01T12:00:00.000Z",
  },
  {
    id: "atlas-of-morning",
    title: "Atlas of Morning",
    author: "Elias Hart",
    description:
      "A reflective premium work that follows ambition, grief, and renewal across cities shaped by first light.",
    category: "Contemporary",
    type: "paid",
    price: "14.99",
    currency: "USD",
    featured: true,
    published: true,
    coverUrl:
      "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80",
    pdfUrl: "",
    pdfFileName: "atlas-of-morning.pdf",
    createdAt: "2026-03-02T12:00:00.000Z",
  },
  {
    id: "paper-sky",
    title: "Paper Sky",
    author: "Jon Mercer",
    description:
      "A lyrical poetry collection filled with spare language, intimate images, and meditations on becoming.",
    category: "Poetry",
    type: "free",
    price: "Free",
    currency: "USD",
    featured: false,
    published: true,
    coverUrl:
      "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=900&q=80",
    pdfUrl: "",
    pdfFileName: "paper-sky.pdf",
    createdAt: "2026-03-03T12:00:00.000Z",
  },
];

const STORAGE_KEYS = {
  books: "luma_books",
  session: "luma_session",
  purchases: "luma_purchases",
  adminSession: "luma_admin_session",
};

const config = window.APP_CONFIG || {};
const page = document.body.dataset.page || "home";

const state = {
  books: loadBooks(),
  filter: "all",
  authMode: "signup",
  activeBook: null,
  session: getJSON(STORAGE_KEYS.session, null),
  purchases: getJSON(STORAGE_KEYS.purchases, []),
  adminSession: getJSON(STORAGE_KEYS.adminSession, null),
  activeTransferRequest: null,
  adminTransferRequests: [],
  adminDraftFiles: {
    cover: null,
    pdf: null,
  },
};

let activeReaderPdfObjectUrl = null;
const CLOUDINARY_LARGE_UPLOAD_THRESHOLD_BYTES = 95 * 1024 * 1024;
const CLOUDINARY_UPLOAD_CHUNK_SIZE_BYTES = 20 * 1024 * 1024;

function getJSON(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function setJSON(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadBooks() {
  const storedBooks = getJSON(STORAGE_KEYS.books, null);
  if (storedBooks && Array.isArray(storedBooks) && storedBooks.length) {
    return storedBooks;
  }

  setJSON(STORAGE_KEYS.books, DEFAULT_BOOKS);
  return [...DEFAULT_BOOKS];
}

function saveBooks() {
  setJSON(STORAGE_KEYS.books, state.books);
}

function updateSession(user) {
  state.session = user;
  if (user) {
    setJSON(STORAGE_KEYS.session, user);
    return;
  }

  window.localStorage.removeItem(STORAGE_KEYS.session);
}

function updatePurchases(purchases) {
  state.purchases = purchases;
  setJSON(STORAGE_KEYS.purchases, purchases);
}

function updateAdminSession(session) {
  state.adminSession = session;
  setJSON(STORAGE_KEYS.adminSession, session);
}

function getFirebaseSettings() {
  return {
    enabled: Boolean(config.firebase?.enabled),
    apiKey: config.firebase?.apiKey || "",
    projectId: config.firebase?.projectId || "",
  };
}

function hasFirebaseClientConfig() {
  const firebase = getFirebaseSettings();
  return Boolean(firebase.enabled && firebase.apiKey && firebase.projectId);
}

function hasFirebaseAdminAuthConfig() {
  return hasFirebaseClientConfig();
}

function isAdminSessionStructureValid(session) {
  return Boolean(session && session.email && session.localId && session.idToken);
}

function parseJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch (error) {
    return null;
  }
}

function hasAdminClaim(idToken) {
  const payload = parseJwtPayload(idToken);
  return Boolean(payload && (payload.admin === true || payload.role === "admin"));
}

function getAdminVerificationEndpoint() {
  return config.admin?.verificationEndpoint || "/.netlify/functions/verify-admin-access";
}

function getFirestoreFieldValue(field) {
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
    return (field.arrayValue.values || []).map(getFirestoreFieldValue);
  }

  if ("mapValue" in field) {
    return Object.entries(field.mapValue.fields || {}).reduce((result, [key, value]) => {
      result[key] = getFirestoreFieldValue(value);
      return result;
    }, {});
  }

  return null;
}

function toFirestoreFieldValue(value) {
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
        values: value.map(toFirestoreFieldValue),
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

function toFirestoreFields(value) {
  return Object.entries(value).reduce((fields, [key, fieldValue]) => {
    fields[key] = toFirestoreFieldValue(fieldValue);
    return fields;
  }, {});
}

function fromFirestoreDocument(document) {
  return {
    id: document.name.split("/").pop(),
    ...Object.entries(document.fields || {}).reduce((result, [key, value]) => {
      result[key] = getFirestoreFieldValue(value);
      return result;
    }, {}),
  };
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data?.error === "string" ? data.error : data?.error?.message) || data?.message || "Request failed."
    );
  }

  return data;
}

async function signInWithFirebaseEmailPassword(email, password) {
  const firebase = getFirebaseSettings();
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebase.apiKey}`;
  const data = await postJson(endpoint, {
    email,
    password,
    returnSecureToken: true,
  });

  return {
    email: data.email,
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
    signedInAt: new Date().toISOString(),
  };
}

async function signUpWithFirebaseEmailPassword(email, password) {
  const firebase = getFirebaseSettings();
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebase.apiKey}`;
  const data = await postJson(endpoint, {
    email,
    password,
    returnSecureToken: true,
  });

  return {
    email: data.email,
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
    signedInAt: new Date().toISOString(),
  };
}

async function refreshFirebaseSession(session) {
  const firebase = getFirebaseSettings();
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebase.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }).toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Session refresh failed.");
  }

  return {
    email: session.email,
    localId: data.user_id,
    idToken: data.id_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    signedInAt: session.signedInAt || new Date().toISOString(),
  };
}

async function getAdminUserDocument(localId, idToken) {
  const firebase = getFirebaseSettings();
  const endpoint = `https://firestore.googleapis.com/v1/projects/${firebase.projectId}/databases/(default)/documents/users/${encodeURIComponent(localId)}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to load admin profile.");
  }

  return data;
}

async function verifyAdminAccessWithFunction(session) {
  const response = await fetch(getAdminVerificationEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: session.localId,
      email: session.email,
      idToken: session.idToken,
    }),
  });

  if (response.status === 404) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Unable to verify admin access.");
  }

  return typeof data?.isAdmin === "boolean" ? data.isAdmin : null;
}

async function upsertUserProfile(session, profile) {
  const firebase = getFirebaseSettings();
  const endpoint = `https://firestore.googleapis.com/v1/projects/${firebase.projectId}/databases/(default)/documents/users/${encodeURIComponent(session.localId)}`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        email: {
          stringValue: profile.email,
        },
        name: {
          stringValue: profile.name || "Reader",
        },
        role: {
          stringValue: profile.role || "reader",
        },
        createdAt: {
          stringValue: profile.createdAt || new Date().toISOString(),
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to save user profile.");
  }

  return data;
}

async function verifyAdminAccess(session) {
  if (!isAdminSessionStructureValid(session)) {
    return false;
  }

  if (hasAdminClaim(session.idToken)) {
    return true;
  }

  try {
    const functionResult = await verifyAdminAccessWithFunction(session);
    if (typeof functionResult === "boolean") {
      return functionResult;
    }
  } catch (error) {
    // Fall back to the direct Firestore check if the helper function is unavailable.
  }

  try {
    const userDoc = await getAdminUserDocument(session.localId, session.idToken);
    const fields = userDoc?.fields || {};
    const role = getFirestoreFieldValue(fields.role);
    const admin = getFirestoreFieldValue(fields.admin);
    return role === "admin" || admin === true;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Admin verification could not reach Firestore. Deploy the Netlify admin verification function or check your browser network policy."
      );
    }
    throw error;
  }
}

async function getUsableAdminSession(session) {
  if (!isAdminSessionStructureValid(session)) {
    return null;
  }

  if (session.expiresAt && Date.now() < Number(session.expiresAt) - 60000) {
    return session;
  }

  if (!session.refreshToken) {
    return null;
  }

  try {
    return await refreshFirebaseSession(session);
  } catch (error) {
    return null;
  }
}

async function getUsableReaderSession(session) {
  if (!isAdminSessionStructureValid(session)) {
    return null;
  }

  if (session.expiresAt && Date.now() < Number(session.expiresAt) - 60000) {
    return session;
  }

  if (!session.refreshToken) {
    return null;
  }

  try {
    return await refreshFirebaseSession(session);
  } catch (error) {
    return null;
  }
}

function formatFirebaseAuthError(message) {
  const friendly = {
    EMAIL_NOT_FOUND: "Incorrect email or password.",
    INVALID_PASSWORD: "Incorrect email or password.",
    INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
    USER_DISABLED: "This account has been disabled.",
    MISSING_PASSWORD: "Enter the admin email and password.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many login attempts. Please try again later.",
    EMAIL_EXISTS: "This email already has an account. Use Sign in instead.",
    WEAK_PASSWORD : "Password should be at least 6 characters.",
    "Missing or insufficient permissions.": "Firebase signed you in, but Firestore rules are blocking the admin check. Publish the firestore.rules file in Firebase.",
    "Unable to load admin profile.": "Firebase signed you in, but the admin user profile could not be loaded. Check the users collection and Firestore rules.",
    "Unable to save user profile.": "Firebase account worked, but Firestore could not save the user profile. Publish the firestore.rules file.",
    "Admin verification could not reach Firestore. Deploy the Netlify admin verification function or check your browser network policy.": "Firebase signed you in, but the admin check could not reach Firestore. Deploy the Netlify admin verification function and make sure you open the site through Netlify or a real local server.",
    "Failed to fetch": "A network request failed after sign-in. This usually means the browser or hosting setup blocked the admin verification request.",
  };

  return friendly[message] || message || "Unable to sign in.";
}

function getFirestoreBaseUrl() {
  const firebase = getFirebaseSettings();
  return `https://firestore.googleapis.com/v1/projects/${firebase.projectId}/databases/(default)/documents`;
}

function getFirestoreHeaders(session, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (session?.idToken) {
    headers.Authorization = `Bearer ${session.idToken}`;
  }

  return headers;
}

async function fetchFirestoreDocumentList(collectionName, session = null) {
  const response = await fetch(`${getFirestoreBaseUrl()}/${collectionName}?pageSize=100`, {
    headers: getFirestoreHeaders(session),
  });

  if (response.status === 404) {
    return [];
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Unable to load ${collectionName}.`);
  }

  return (data.documents || []).map(fromFirestoreDocument);
}

async function writeFirestoreDocument(collectionName, documentId, value, session) {
  const response = await fetch(
    `${getFirestoreBaseUrl()}/${collectionName}/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      headers: getFirestoreHeaders(session),
      body: JSON.stringify({
        fields: toFirestoreFields(value),
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Unable to save ${collectionName} document.`);
  }

  return fromFirestoreDocument(data);
}

async function deleteFirestoreDocument(collectionName, documentId, session) {
  const response = await fetch(
    `${getFirestoreBaseUrl()}/${collectionName}/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
      headers: getFirestoreHeaders(session),
    }
  );

  if (response.status === 404) {
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Unable to delete ${collectionName} document.`);
  }
}

async function queryFirestoreDocuments(structuredQuery, session, fallbackMessage) {
  const response = await fetch(`${getFirestoreBaseUrl()}:runQuery`, {
    method: "POST",
    headers: getFirestoreHeaders(session),
    body: JSON.stringify({
      structuredQuery,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || fallbackMessage || "Unable to load documents.");
  }

  return (Array.isArray(data) ? data : [])
    .map((entry) => entry.document)
    .filter(Boolean)
    .map(fromFirestoreDocument);
}

async function queryUserPurchases(session) {
  const purchases = await queryFirestoreDocuments(
    {
      from: [
        {
          collectionId: "purchases",
        },
      ],
      where: {
        fieldFilter: {
          field: {
            fieldPath: "userId",
          },
          op: "EQUAL",
          value: {
            stringValue: session.localId,
          },
        },
      },
    },
    session,
    "Unable to load purchases."
  );

  return purchases.filter((purchase) => purchase.status === "paid");
}

function normalizeTransferRequestRecord(request) {
  return {
    id: request.id,
    bookId: request.bookId || "",
    bookTitle: request.bookTitle || "",
    userId: request.userId || "",
    userEmail: request.userEmail || "",
    amount: String(request.amount || ""),
    currency: request.currency || "NGN",
    bankName: request.bankName || "",
    accountName: request.accountName || "",
    accountNumber: request.accountNumber || "",
    paymentReference: request.paymentReference || "",
    senderName: request.senderName || "",
    payerNote: request.payerNote || "",
    proofUrl: request.proofUrl || "",
    status: request.status || "awaiting_payment",
    createdAt: request.createdAt || new Date().toISOString(),
    paymentSubmittedAt: request.paymentSubmittedAt || "",
    reviewedAt: request.reviewedAt || "",
    reviewedBy: request.reviewedBy || "",
    adminNote: request.adminNote || "",
  };
}

async function queryUserTransferRequests(session) {
  if (!session?.localId) {
    return [];
  }

  const requests = await queryFirestoreDocuments(
    {
      from: [
        {
          collectionId: "transferRequests",
        },
      ],
      where: {
        fieldFilter: {
          field: {
            fieldPath: "userId",
          },
          op: "EQUAL",
          value: {
            stringValue: session.localId,
          },
        },
      },
    },
    session,
    "Unable to load bank transfer requests."
  );

  return requests
    .map(normalizeTransferRequestRecord)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
}

async function fetchAdminTransferRequests(session) {
  const requests = await fetchFirestoreDocumentList("transferRequests", session);
  return requests
    .map(normalizeTransferRequestRecord)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
}

function getBankTransferConfig() {
  return {
    enabled: Boolean(config.bankTransfer?.enabled),
    bankName: config.bankTransfer?.bankName || "Wema Bank",
    accountNumber: config.bankTransfer?.accountNumber || "",
    accountName: config.bankTransfer?.accountName || "",
    currency: config.bankTransfer?.currency || "NGN",
  };
}

function getShortUserKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(-6) || "READER";
}

function createTransferRequestId(bookId, userId) {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `tr_${slugify(bookId).slice(0, 24)}_${slugify(userId).slice(0, 24)}_${Date.now()}_${randomPart}`;
}

function createPaymentReference(bookId, userId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const bookPart = slugify(bookId).replace(/-/g, "").toUpperCase().slice(0, 6) || "BOOK";
  const userPart = getShortUserKey(userId);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `WEMA-${bookPart}-${userPart}-${datePart}-${randomPart}`;
}

function isTransferRequestOpen(request) {
  return ["awaiting_payment", "payment_submitted", "needs_review"].includes(request.status);
}

function getLatestTransferRequestForBook(requests, bookId) {
  return requests.find((request) => request.bookId === bookId && isTransferRequestOpen(request)) || null;
}

async function getCurrentTransferRequestForBook(bookId) {
  if (!state.session?.idToken) {
    return null;
  }

  const requests = await queryUserTransferRequests(state.session);
  const activeRequest = getLatestTransferRequestForBook(requests, bookId);
  state.activeTransferRequest = activeRequest;
  return activeRequest;
}

async function syncAdminTransferRequests() {
  if (!state.adminSession?.idToken || !hasFirebaseClientConfig()) {
    state.adminTransferRequests = [];
    return false;
  }

  state.adminTransferRequests = await fetchAdminTransferRequests(state.adminSession);
  return true;
}

function normalizeBookRecord(book) {
  return {
    id: book.id,
    title: book.title || "",
    author: book.author || "",
    description: book.description || "",
    category: book.category || "",
    type: book.type === "paid" ? "paid" : "free",
    price: book.type === "paid" ? String(book.price || "0.00") : "Free",
    currency: book.currency || "USD",
    featured: Boolean(book.featured),
    published: Boolean(book.published),
    coverUrl: book.coverUrl || "",
    pdfUrl: book.pdfUrl || "",
    pdfFileName: book.pdfFileName || "",
    createdAt: book.createdAt || new Date().toISOString(),
  };
}

async function syncBooksFromFirestore(includeDrafts = false, session = null) {
  if (!hasFirebaseClientConfig()) {
    return false;
  }

  const documents = await fetchFirestoreDocumentList("books", session);
  const books = documents
    .map(normalizeBookRecord)
    .filter((book) => includeDrafts || book.published)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

  if (books.length) {
    state.books = books;
    saveBooks();
    return true;
  }

  return false;
}

async function syncReaderPurchases() {
  if (!hasFirebaseClientConfig() || !state.session?.localId || !state.session?.idToken) {
    return false;
  }

  const purchases = await queryUserPurchases(state.session);
  updatePurchases(purchases);
  return true;
}

async function restoreAdminAccess() {
  const usableSession = await getUsableAdminSession(state.adminSession);
  if (!usableSession) {
    updateAdminSession(null);
    return false;
  }

  try {
    const isAdmin = await verifyAdminAccess(usableSession);
    if (!isAdmin) {
      updateAdminSession(null);
      return false;
    }

    updateAdminSession(usableSession);
    try {
      await syncBooksFromFirestore(true, usableSession);
    } catch (error) {
      // Keep local book cache if Firestore books are not ready yet.
    }
    try {
      await syncAdminTransferRequests();
    } catch (error) {
      state.adminTransferRequests = [];
    }
    revealDashboard();
    renderDashboardStats();
    renderAdminBookList();
    renderAdminTransferRequests();
    return true;
  } catch (error) {
    updateAdminSession(null);
    return false;
  }
}

async function restoreReaderAccess() {
  const usableSession = await getUsableReaderSession(state.session);
  if (!usableSession) {
    updateSession(null);
    updatePurchases([]);
    return false;
  }

  updateSession({
    ...usableSession,
    name: usableSession.email || usableSession.name || state.session?.email || state.session?.name || "Reader",
  });
  return true;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPrice(book) {
  if (book.type === "free") {
    return "Free";
  }

  if (!book.price || book.price === "Free") {
    return `Paid (${book.currency || "USD"})`;
  }

  return `${book.currency || "USD"} ${book.price}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toast(message) {
  window.alert(message);
}

function integrationFlags() {
  return {
    firebase: Boolean(config.firebase && config.firebase.enabled),
    cloudinary: Boolean(config.cloudinary && config.cloudinary.enabled),
    bankTransfer: Boolean(config.bankTransfer && config.bankTransfer.enabled),
  };
}

function renderIntegrationBanner(targetId) {
  const container = document.getElementById(targetId);
  if (!container) {
    return;
  }

  if (targetId === "integrationBanner") {
    container.innerHTML = `
      <div class="status-banner-copy">
        <strong>Member library access.</strong>
        <span>
          Browse the collection freely, create an account in seconds, and return to your reading from any device.
        </span>
      </div>
      <div class="status-pill-row">
        <span class="status-pill active">Curated collection</span>
        <span class="status-pill active">Reader accounts</span>
        <span class="status-pill active">Protected access</span>
      </div>
    `;
    return;
  }

  const flags = integrationFlags();
  const items = [
    { label: "Firebase", active: flags.firebase },
    { label: "Cloudinary", active: flags.cloudinary },
    { label: "Wema transfer", active: flags.bankTransfer },
  ];

  container.innerHTML = `
    <div class="status-banner-copy">
      <strong>Production services status.</strong>
      <span>
        Confirm that authentication, storage, and payments are connected before publishing changes to customers.
      </span>
    </div>
    <div class="status-pill-row">
      ${items
        .map(
          (item) => `
            <span class="status-pill ${item.active ? "active" : ""}">
              ${item.label}: ${item.active ? "connected" : "requires configuration"}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function canAccessBook(book) {
  if (!state.session) {
    return false;
  }

  if (book.type === "free") {
    return true;
  }

  return state.purchases.some((purchase) => purchase.bookId === book.id);
}

function buildCoverStyle(book) {
  const image = book.coverUrl
    ? `linear-gradient(135deg, rgba(15,23,32,0.68), rgba(10,132,255,0.28)), url('${book.coverUrl}')`
    : "linear-gradient(135deg, rgba(15,23,32,0.95), rgba(10,132,255,0.7))";
  return image;
}

function getPublishedBooks() {
  return state.books
    .filter((book) => book.published)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
}

function renderPublicBooks() {
  const bookGrid = document.getElementById("bookGrid");
  const emptyState = document.getElementById("bookEmptyState");
  if (!bookGrid || !emptyState) {
    return;
  }

  const books = getPublishedBooks().filter((book) => {
    if (state.filter === "all") {
      return true;
    }
    return book.type === state.filter;
  });

  if (!books.length) {
    bookGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  bookGrid.innerHTML = books
    .map(
      (book) => `
        <article class="book-card reveal is-visible">
          <div class="book-cover" style="background-image: ${buildCoverStyle(book)};"></div>
          <div class="pill-row">
            <span class="pill ${book.type === "free" ? "pill-free" : "pill-paid"}">
              ${book.type === "free" ? "Free access" : "Premium"}
            </span>
            ${book.featured ? '<span class="pill pill-featured">Featured</span>' : ""}
          </div>
          <h3>${escapeHtml(book.title)}</h3>
          <p>${escapeHtml(book.description)}</p>
          <div class="book-meta">
            <span>${escapeHtml(book.author)}</span>
            <span>${escapeHtml(book.category || "General")}</span>
          </div>
          <div class="book-actions">
            <button class="ghost-button" type="button" data-preview-book="${book.id}">
              Preview
            </button>
            <button class="primary-button" type="button" data-read-book="${book.id}">
              ${!state.session ? "Log in to read" : canAccessBook(book) ? "Open reader" : book.type === "free" ? "Open reader" : `Unlock ${formatPrice(book)}`}
            </button>
          </div>
        </article>
      `
    )
    .join("");

  bindPublicBookActions();
}

function formatTransferStatus(status) {
  const labels = {
    awaiting_payment: "Awaiting payment",
    payment_submitted: "Pending admin confirmation",
    approved: "Approved",
    rejected: "Rejected",
    needs_review: "Needs review",
  };

  return labels[status] || "Pending";
}

function formatTransferTimestamp(value, fallback = "Not yet") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function buildBankTransferDetailsMarkup(book, request) {
  const bank = getBankTransferConfig();

  return `
    <div class="bank-transfer-box">
      <p class="bank-transfer-title">Wema bank transfer details</p>
      <div class="bank-transfer-grid">
        <div class="bank-transfer-detail">
          <span>Bank</span>
          <strong>${escapeHtml(bank.bankName)}</strong>
        </div>
        <div class="bank-transfer-detail">
          <span>Account number</span>
          <strong>${escapeHtml(bank.accountNumber)}</strong>
        </div>
        <div class="bank-transfer-detail">
          <span>Account name</span>
          <strong>${escapeHtml(bank.accountName)}</strong>
        </div>
        <div class="bank-transfer-detail">
          <span>Amount</span>
          <strong>${escapeHtml(formatPrice(book))}</strong>
        </div>
        <div class="bank-transfer-detail bank-transfer-detail-wide">
          <span>Payment reference</span>
          <strong>${escapeHtml(request.paymentReference)}</strong>
        </div>
      </div>
      <p class="bank-transfer-copy">
        Use the payment reference above in your bank narration so the admin can match your transfer quickly.
      </p>
    </div>
  `;
}

function renderAwaitingTransferRequest(book, request) {
  const actions = document.getElementById("bookModalActions");
  if (!actions) {
    return;
  }

  actions.innerHTML = `
    ${buildBankTransferDetailsMarkup(book, request)}
    <div class="bank-transfer-form">
      <label>
        Sender name
        <input id="transferSenderName" type="text" placeholder="Name used on the transfer" value="${escapeHtml(request.senderName)}" />
      </label>
      <label>
        Payment time
        <input id="transferPaidAt" type="datetime-local" />
      </label>
      <label>
        Optional note or proof URL
        <input id="transferProofUrl" type="text" placeholder="Optional proof link or short note" value="${escapeHtml(request.proofUrl || request.payerNote)}" />
      </label>
      <div class="bank-transfer-note">
        Your request is already saved. If this page refreshes, we will reopen this same payment request for your account.
      </div>
      <div class="modal-actions bank-transfer-actions">
        <button class="ghost-button" type="button" data-payment="bank-transfer">
          Refresh details
        </button>
        <button class="primary-button" type="button" data-submit-bank-transfer="${request.id}">
          I have made payment
        </button>
      </div>
    </div>
  `;
}

function renderSubmittedTransferRequest(book, request) {
  const actions = document.getElementById("bookModalActions");
  if (!actions) {
    return;
  }

  const copy =
    request.status === "approved"
      ? `${book.title} has been approved for your account. Refresh the library or reopen this book if it has not unlocked yet.`
      : `Your payment request was submitted on ${formatTransferTimestamp(
          request.paymentSubmittedAt,
          "this device"
        )}. We will unlock ${book.title} after the admin confirms the transfer in the Wema account.`;

  actions.innerHTML = `
    ${buildBankTransferDetailsMarkup(book, request)}
    <div class="bank-transfer-box bank-transfer-status-box">
      <p class="bank-transfer-title">${escapeHtml(formatTransferStatus(request.status))}</p>
      <p class="bank-transfer-copy">
        ${escapeHtml(copy)}
      </p>
      ${
        request.adminNote
          ? `<p class="bank-transfer-note">Admin note: ${escapeHtml(request.adminNote)}</p>`
          : '<p class="bank-transfer-note">If you already transferred successfully, you do not need to submit again.</p>'
      }
    </div>
  `;
}

async function showBankTransferState(book) {
  const bank = getBankTransferConfig();
  if (!bank.enabled || !bank.accountNumber || !bank.accountName) {
    toast("Wema bank transfer is not fully configured yet.");
    return;
  }

  if (!state.session?.idToken) {
    openAuthModal("signin");
    return;
  }

  try {
    let request = await getCurrentTransferRequestForBook(book.id);

    if (!request) {
      const timestamp = new Date().toISOString();
      request = normalizeTransferRequestRecord({
        id: createTransferRequestId(book.id, state.session.localId),
        bookId: book.id,
        bookTitle: book.title,
        userId: state.session.localId,
        userEmail: state.session.email,
        amount: book.price,
        currency: book.currency || bank.currency,
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountNumber: bank.accountNumber,
        paymentReference: createPaymentReference(book.id, state.session.localId),
        status: "awaiting_payment",
        createdAt: timestamp,
      });

      await writeFirestoreDocument("transferRequests", request.id, request, state.session);
    }

    state.activeTransferRequest = request;

    if (request.status === "payment_submitted" || request.status === "needs_review") {
      renderSubmittedTransferRequest(book, request);
      return;
    }

    if (request.status === "approved") {
      await syncReaderPurchases();
      renderPublicBooks();
      if (canAccessBook(book)) {
        openBookModal(book.id);
        return;
      }
      renderSubmittedTransferRequest(book, request);
      return;
    }

    renderAwaitingTransferRequest(book, request);
  } catch (error) {
    toast(error.message || "Unable to load Wema transfer details.");
  }
}

async function submitBankTransferRequest(requestId) {
  const book = state.activeBook;
  const request = state.activeTransferRequest;

  if (!book || !request || request.id !== requestId || !state.session?.idToken) {
    toast("Open the transfer details again before submitting payment.");
    return;
  }

  const senderName = document.getElementById("transferSenderName")?.value.trim() || "";
  const paidAtValue = document.getElementById("transferPaidAt")?.value || "";
  const proofOrNote = document.getElementById("transferProofUrl")?.value.trim() || "";

  if (!senderName) {
    toast("Enter the sender name used for the transfer.");
    return;
  }

  const updatedRequest = normalizeTransferRequestRecord({
    ...request,
    senderName,
    proofUrl: proofOrNote.startsWith("http://") || proofOrNote.startsWith("https://") ? proofOrNote : "",
    payerNote: proofOrNote.startsWith("http://") || proofOrNote.startsWith("https://") ? request.payerNote : proofOrNote,
    status: "payment_submitted",
    paymentSubmittedAt: paidAtValue ? new Date(paidAtValue).toISOString() : new Date().toISOString(),
  });

  try {
    await writeFirestoreDocument("transferRequests", updatedRequest.id, updatedRequest, state.session);
    state.activeTransferRequest = updatedRequest;
    renderSubmittedTransferRequest(book, updatedRequest);
    toast("Payment submitted. The admin can now review and confirm your transfer.");
  } catch (error) {
    toast(error.message || "Unable to submit this bank transfer request.");
  }
}

function openAuthModal(mode) {
  const authModal = document.getElementById("authModal");
  const authModeLabel = document.getElementById("authModeLabel");
  const authTitle = document.getElementById("authTitle");
  const authCopy = document.getElementById("authCopy");
  const authActionButton = document.getElementById("authActionButton");
  if (!authModal || !authModeLabel || !authTitle || !authCopy || !authActionButton) {
    return;
  }

  state.authMode = mode;
  const signup = mode === "signup";
  authModeLabel.textContent = signup ? "Create account" : "Welcome back";
  authTitle.textContent = signup ? "Start your reading account." : "Sign in to continue reading.";
  authCopy.textContent = signup
    ? "Create your account to save your place, unlock your library, and read across every device."
    : "Sign in to continue reading, revisit unlocked titles, and pick up where you left off.";
  authActionButton.textContent = signup ? "Create account" : "Sign in";
  authModal.showModal();
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog && dialog.open) {
    dialog.close();
  }
}

function openBookModal(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  const bookModal = document.getElementById("bookModal");
  if (!book || !bookModal) {
    return;
  }

  state.activeBook = book;

  document.getElementById("bookModalType").textContent = book.type === "free" ? "Free book" : "Premium book";
  document.getElementById("bookModalTitle").textContent = book.title;
  document.getElementById("bookModalDescription").textContent = book.description;
  document.getElementById("bookModalPrice").textContent = formatPrice(book);
  document.getElementById("bookModalMeta").textContent = `${book.author} • ${book.category || "General"}`;
  document.getElementById("bookModalCover").style.backgroundImage = buildCoverStyle(book);

  const actions = document.getElementById("bookModalActions");
  const userMissing = !state.session;
  const unlocked = canAccessBook(book);

  if (userMissing) {
    actions.innerHTML = `
      <button class="primary-button" type="button" data-auth-required="signin">
        Log in to read
      </button>
    `;
  } else if (unlocked) {
    actions.innerHTML = `
      <a class="primary-button button-link" href="./reader.html?id=${encodeURIComponent(book.id)}">
        Open reader
      </a>
    `;
  } else {
    actions.innerHTML = `
      <div class="bank-transfer-box">
        <p class="bank-transfer-title">Pay via Wema Bank transfer</p>
        <p class="bank-transfer-copy">
          We will save a payment request for this exact book and account before showing the transfer details.
        </p>
        <button class="payment-button" type="button" data-payment="bank-transfer">
          View Wema transfer details
        </button>
      </div>
    `;
  }

  bookModal.showModal();
}

function bindPublicBookActions() {
  document.querySelectorAll("[data-preview-book]").forEach((button) => {
    button.addEventListener("click", () => openBookModal(button.dataset.previewBook));
  });

  document.querySelectorAll("[data-read-book]").forEach((button) => {
    button.addEventListener("click", () => {
      const book = state.books.find((item) => item.id === button.dataset.readBook);
      if (!book) {
        return;
      }

      if (!state.session) {
        openAuthModal("signin");
        return;
      }

      if (canAccessBook(book)) {
        window.location.href = `./reader.html?id=${encodeURIComponent(book.id)}`;
        return;
      }

      openBookModal(book.id);
    });
  });
}

function renderSignedInChrome() {
  const sessionEmail = state.session?.email || "";
  const statusText = document.getElementById("userStatusText");
  if (statusText) {
    statusText.textContent = sessionEmail || "Browse as guest";
  }

  const publicTopbar = document.getElementById("publicTopbarActions");
  if (publicTopbar) {
    publicTopbar.innerHTML = sessionEmail
      ? `
          <span class="user-badge" title="${escapeHtml(sessionEmail)}">${escapeHtml(sessionEmail)}</span>
          <button class="ghost-button" type="button" data-logout>Log out</button>
        `
      : `
          <button class="ghost-button" data-open-auth="signin" type="button">Sign in</button>
          <button class="primary-button" data-open-auth="signup" type="button">Create account</button>
        `;
  }

  const readerTopbar = document.getElementById("readerTopbarActions");
  if (readerTopbar) {
    readerTopbar.innerHTML = sessionEmail
      ? `
          <a class="ghost-button button-link" data-static-link href="./index.html">Library</a>
          <a class="ghost-button button-link" data-static-link href="./admin.html">Admin</a>
          <span class="user-badge" title="${escapeHtml(sessionEmail)}">${escapeHtml(sessionEmail)}</span>
          <button class="ghost-button" type="button" data-logout>Log out</button>
        `
      : `
          <a class="ghost-button button-link" data-static-link href="./index.html">Library</a>
          <a class="ghost-button button-link" data-static-link href="./admin.html">Admin</a>
          <a class="primary-button button-link" href="./index.html">Sign in to read</a>
        `;
  }
}

function setupPublicFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
      renderPublicBooks();
    });
  });
}

function setupAuthForm() {
  const authForm = document.getElementById("authForm");
  const authActionButton = document.getElementById("authActionButton");
  if (!authForm) {
    return;
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    if (!email || !password) {
      toast("Enter your email address and password.");
      return;
    }

    if (!hasFirebaseAdminAuthConfig()) {
      toast("Firebase config is incomplete. Add the real Firebase values in config.js first.");
      return;
    }

    if (authActionButton) {
      authActionButton.disabled = true;
      authActionButton.textContent = state.authMode === "signup" ? "Creating account..." : "Signing in...";
    }

    try {
      const baseSession =
        state.authMode === "signup"
          ? await signUpWithFirebaseEmailPassword(email, password)
          : await signInWithFirebaseEmailPassword(email, password);

      const user = {
        ...baseSession,
        name: baseSession.email,
        email: baseSession.email,
        createdAt: state.session?.createdAt || new Date().toISOString(),
      };

      await upsertUserProfile(user, {
        email: user.email,
        name: user.name,
        role: "reader",
        createdAt: user.createdAt,
      });

      updateSession(user);
      try {
        await syncReaderPurchases();
      } catch (error) {
        updatePurchases([]);
      }
      renderSignedInChrome();
      closeDialog("authModal");
      renderPublicBooks();
      toast(
        state.authMode === "signup"
          ? `Account created. You are now logged in as ${user.email}.`
          : `Signed in successfully as ${user.email}.`
      );
    } catch (error) {
      toast(formatFirebaseAuthError(error.message || "Unable to sign in."));
    } finally {
      if (authActionButton) {
        authActionButton.disabled = false;
        authActionButton.textContent = state.authMode === "signup" ? "Create account" : "Sign in";
      }
    }
  });
}

function setupPublicModalsAndActions() {
  const closeBookModal = document.getElementById("closeBookModal");
  if (closeBookModal) {
    closeBookModal.addEventListener("click", () => closeDialog("bookModal"));
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.authRequired) {
      closeDialog("bookModal");
      openAuthModal(target.dataset.authRequired);
    }

    if (target.dataset.openAuth) {
      openAuthModal(target.dataset.openAuth);
    }

    if (target.dataset.logout !== undefined) {
      updateSession(null);
      updatePurchases([]);
      state.activeTransferRequest = null;
      renderSignedInChrome();
      renderPublicBooks();

      if (page === "reader") {
        window.location.href = "./index.html";
        return;
      }

      toast("You have been logged out.");
    }

    if (target.dataset.payment === "bank-transfer") {
      await showBankTransferState(state.activeBook);
    }

    if (target.dataset.submitBankTransfer) {
      await submitBankTransferRequest(target.dataset.submitBankTransfer);
    }
  });
}

async function buildPublicPage() {
  renderIntegrationBanner("integrationBanner");
  await restoreReaderAccess();
  try {
    await syncBooksFromFirestore(false);
  } catch (error) {
    // Keep local books when Firestore is not ready yet.
  }
  try {
    await syncReaderPurchases();
  } catch (error) {
    // Keep local purchases when Firestore is not ready yet.
  }
  renderSignedInChrome();
  renderPublicBooks();
  setupPublicFilters();
  setupAuthForm();
  setupPublicModalsAndActions();
}

function renderDashboardStats() {
  const stats = document.getElementById("dashboardStats");
  if (!stats) {
    return;
  }

  const allBooks = state.books.length;
  const published = state.books.filter((book) => book.published).length;
  const premium = state.books.filter((book) => book.type === "paid").length;
  const pendingTransfers = state.adminTransferRequests.filter((request) =>
    ["payment_submitted", "needs_review"].includes(request.status)
  ).length;

  stats.innerHTML = `
    <article class="stat-card">
      <span>Total books</span>
      <strong>${allBooks}</strong>
    </article>
    <article class="stat-card">
      <span>Published</span>
      <strong>${published}</strong>
    </article>
    <article class="stat-card">
      <span>Premium</span>
      <strong>${premium}</strong>
    </article>
    <article class="stat-card">
      <span>Bank transfers waiting</span>
      <strong>${pendingTransfers}</strong>
    </article>
  `;
}

function renderAdminTransferRequests() {
  const container = document.getElementById("adminTransferRequestList");
  const emptyState = document.getElementById("adminTransferEmptyState");
  if (!container || !emptyState) {
    return;
  }

  if (!state.adminTransferRequests.length) {
    container.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  container.innerHTML = state.adminTransferRequests
    .map(
      (request) => `
        <article class="transfer-request-card">
          <div class="transfer-request-header">
            <div>
              <h3>${escapeHtml(request.bookTitle || request.bookId)}</h3>
              <p>${escapeHtml(request.userEmail || request.userId)}</p>
            </div>
            <span class="pill ${request.status === "approved" ? "pill-featured" : request.status === "rejected" ? "pill-draft" : "pill-paid"}">
              ${escapeHtml(formatTransferStatus(request.status))}
            </span>
          </div>
          <div class="transfer-request-grid">
            <div><span>User ID</span><strong>${escapeHtml(request.userId)}</strong></div>
            <div><span>Amount</span><strong>${escapeHtml(`${request.currency} ${request.amount}`)}</strong></div>
            <div><span>Reference</span><strong>${escapeHtml(request.paymentReference || "Not provided")}</strong></div>
            <div><span>Sender name</span><strong>${escapeHtml(request.senderName || "Not provided")}</strong></div>
            <div><span>Created</span><strong>${escapeHtml(formatTransferTimestamp(request.createdAt))}</strong></div>
            <div><span>Submitted</span><strong>${escapeHtml(formatTransferTimestamp(request.paymentSubmittedAt))}</strong></div>
          </div>
          ${
            request.proofUrl
              ? `<a class="admin-asset-link" href="${escapeHtml(request.proofUrl)}" target="_blank" rel="noopener noreferrer">Open proof link</a>`
              : ""
          }
          ${
            request.payerNote
              ? `<p class="transfer-request-note"><strong>User note:</strong> ${escapeHtml(request.payerNote)}</p>`
              : ""
          }
          <label>
            Admin note
            <textarea id="adminNote-${escapeHtml(request.id)}" rows="3" placeholder="Optional note for the reader">${escapeHtml(request.adminNote)}</textarea>
          </label>
          <div class="book-actions">
            <button class="primary-button" type="button" data-approve-transfer="${request.id}">
              Approve and unlock
            </button>
            <button class="ghost-button" type="button" data-needs-review-transfer="${request.id}">
              Mark needs review
            </button>
            <button class="ghost-button danger-button" type="button" data-reject-transfer="${request.id}">
              Reject
            </button>
          </div>
        </article>
      `
    )
    .join("");

  bindAdminTransferActions();
}

function renderAdminBookList() {
  const container = document.getElementById("adminBookList");
  const emptyState = document.getElementById("adminEmptyState");
  if (!container || !emptyState) {
    return;
  }

  if (!state.books.length) {
    container.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  container.innerHTML = state.books
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .map(
      (book) => `
        <article class="admin-book-item">
          <div class="admin-book-cover" style="background-image: ${buildCoverStyle(book)};"></div>
          <div class="admin-book-copy">
            <div class="admin-book-header">
              <div>
                <h3>${escapeHtml(book.title)}</h3>
                <p>${escapeHtml(book.author)} • ${escapeHtml(book.category || "General")}</p>
              </div>
              <div class="pill-row">
                <span class="pill ${book.type === "free" ? "pill-free" : "pill-paid"}">${book.type}</span>
                <span class="pill ${book.published ? "pill-featured" : "pill-draft"}">
                  ${book.published ? "Published" : "Draft"}
                </span>
              </div>
            </div>
            <p>${escapeHtml(book.description)}</p>
            <div class="book-meta">
              <span>${formatPrice(book)}</span>
              <span>${book.pdfUrl ? "PDF ready" : book.pdfFileName || "No PDF URL yet"}</span>
            </div>
            <div class="admin-asset-links">
              ${
                book.pdfUrl
                  ? `<a class="admin-asset-link" href="${escapeHtml(book.pdfUrl)}" target="_blank" rel="noopener noreferrer">Saved PDF URL: ${escapeHtml(book.pdfUrl)}</a>`
                  : '<span class="admin-asset-link">Saved PDF URL: not available yet</span>'
              }
              ${
                book.coverUrl
                  ? `<a class="admin-asset-link" href="${escapeHtml(book.coverUrl)}" target="_blank" rel="noopener noreferrer">Saved cover URL: ${escapeHtml(book.coverUrl)}</a>`
                  : '<span class="admin-asset-link">Saved cover URL: not available yet</span>'
              }
            </div>
            <div class="book-actions">
              <button class="ghost-button" type="button" data-edit-book="${book.id}">Edit</button>
              ${book.published ? `<a class="ghost-button button-link" href="./reader.html?id=${encodeURIComponent(book.id)}">Read</a>` : ""}
              <button class="ghost-button" type="button" data-toggle-book="${book.id}">
                ${book.published ? "Unpublish" : "Publish"}
              </button>
              <button class="ghost-button danger-button" type="button" data-delete-book="${book.id}">Delete</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  bindAdminActions();
}

function resetBookForm() {
  const form = document.getElementById("bookForm");
  if (!form) {
    return;
  }

  clearAdminDraftFiles();
  form.reset();
  document.getElementById("editingBookId").value = "";
  document.getElementById("bookCurrency").value = "USD";
  document.getElementById("bookPublished").checked = true;
  document.getElementById("bookFormTitle").textContent = "Add a new book";
  hideAssetConfirmation();
  updateSelectedFileStatus();
}

function fillBookForm(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) {
    return;
  }

  clearAdminDraftFiles();
  document.getElementById("editingBookId").value = book.id;
  document.getElementById("bookTitle").value = book.title;
  document.getElementById("bookAuthor").value = book.author;
  document.getElementById("bookDescription").value = book.description;
  document.getElementById("bookCategory").value = book.category || "";
  document.getElementById("bookType").value = book.type;
  document.getElementById("bookPrice").value = book.type === "free" ? "" : book.price;
  document.getElementById("bookCurrency").value = book.currency || "USD";
  document.getElementById("bookCoverUrl").value = book.coverUrl || "";
  document.getElementById("bookPdfUrl").value = book.pdfUrl || "";
  document.getElementById("bookFeatured").checked = Boolean(book.featured);
  document.getElementById("bookPublished").checked = Boolean(book.published);
  document.getElementById("bookFormTitle").textContent = `Editing "${book.title}"`;
  renderAssetConfirmation(book);
  updateSelectedFileStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindAdminActions() {
  document.querySelectorAll("[data-edit-book]").forEach((button) => {
    button.addEventListener("click", () => fillBookForm(button.dataset.editBook));
  });

  document.querySelectorAll("[data-toggle-book]").forEach((button) => {
    button.addEventListener("click", async () => {
      const book = state.books.find((item) => item.id === button.dataset.toggleBook);
      if (!book) {
        return;
      }

      const updatedBook = normalizeBookRecord({
        ...book,
        published: !book.published,
      });

      try {
        if (hasFirebaseClientConfig() && state.adminSession?.idToken) {
          await writeFirestoreDocument("books", updatedBook.id, updatedBook, state.adminSession);
          await syncBooksFromFirestore(true, state.adminSession);
        } else {
          state.books = state.books.map((item) => (item.id === updatedBook.id ? updatedBook : item));
          saveBooks();
        }

        renderAdminBookList();
        renderDashboardStats();
      } catch (error) {
        toast(error.message || "Unable to update this book.");
      }
    });
  });

  document.querySelectorAll("[data-delete-book]").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this book from your library?");
      if (!confirmed) {
        return;
      }

      try {
        if (hasFirebaseClientConfig() && state.adminSession?.idToken) {
          await deleteFirestoreDocument("books", button.dataset.deleteBook, state.adminSession);
          await syncBooksFromFirestore(true, state.adminSession);
        } else {
          state.books = state.books.filter((book) => book.id !== button.dataset.deleteBook);
          saveBooks();
        }

        renderAdminBookList();
        renderDashboardStats();
        resetBookForm();
      } catch (error) {
        toast(error.message || "Unable to delete this book.");
      }
    });
  });
}

function getAdminTransferNote(requestId) {
  return document.getElementById(`adminNote-${requestId}`)?.value.trim() || "";
}

async function approveTransferRequest(requestId) {
  const request = state.adminTransferRequests.find((item) => item.id === requestId);
  if (!request || !state.adminSession?.idToken) {
    toast("Reload the admin dashboard and try again.");
    return;
  }

  const adminNote = getAdminTransferNote(requestId);
  const timestamp = new Date().toISOString();
  const updatedRequest = normalizeTransferRequestRecord({
    ...request,
    status: "approved",
    adminNote,
    reviewedAt: timestamp,
    reviewedBy: state.adminSession.email,
  });
  const purchaseRecord = {
    bookId: request.bookId,
    bookTitle: request.bookTitle || "",
    userId: request.userId,
    userEmail: request.userEmail,
    customerName: request.senderName || request.userEmail,
    amount: request.amount,
    currency: request.currency || "NGN",
    status: "paid",
    provider: "bank_transfer",
    txRef: request.paymentReference,
    transactionId: request.id,
    paymentStatus: "approved",
    transferRequestId: request.id,
    createdAt: request.createdAt || timestamp,
    verifiedAt: timestamp,
    approvedAt: timestamp,
  };

  try {
    await writeFirestoreDocument("purchases", request.id, purchaseRecord, state.adminSession);
    await writeFirestoreDocument("transferRequests", request.id, updatedRequest, state.adminSession);
    await syncAdminTransferRequests();
    renderAdminTransferRequests();
    renderDashboardStats();
    toast("Transfer approved and the book is now unlocked for that reader.");
  } catch (error) {
    toast(error.message || "Unable to approve this transfer request.");
  }
}

async function updateTransferRequestStatus(requestId, status) {
  const request = state.adminTransferRequests.find((item) => item.id === requestId);
  if (!request || !state.adminSession?.idToken) {
    toast("Reload the admin dashboard and try again.");
    return;
  }

  const adminNote = getAdminTransferNote(requestId);
  const updatedRequest = normalizeTransferRequestRecord({
    ...request,
    status,
    adminNote,
    reviewedAt: new Date().toISOString(),
    reviewedBy: state.adminSession.email,
  });

  try {
    await writeFirestoreDocument("transferRequests", request.id, updatedRequest, state.adminSession);
    await syncAdminTransferRequests();
    renderAdminTransferRequests();
    renderDashboardStats();
    toast(
      status === "rejected"
        ? "Transfer request rejected."
        : "Transfer request marked for another review."
    );
  } catch (error) {
    toast(error.message || "Unable to update this transfer request.");
  }
}

function bindAdminTransferActions() {
  document.querySelectorAll("[data-approve-transfer]").forEach((button) => {
    button.addEventListener("click", async () => {
      await approveTransferRequest(button.dataset.approveTransfer);
    });
  });

  document.querySelectorAll("[data-needs-review-transfer]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateTransferRequestStatus(button.dataset.needsReviewTransfer, "needs_review");
    });
  });

  document.querySelectorAll("[data-reject-transfer]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateTransferRequestStatus(button.dataset.rejectTransfer, "rejected");
    });
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1024) {
    return `${(megabytes / 1024).toFixed(2)} GB`;
  }

  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

async function parseCloudinaryError(response) {
  const fallbackMessage = "Cloudinary upload failed.";

  try {
    const data = await response.json();
    return data?.error?.message || fallbackMessage;
  } catch (error) {
    return fallbackMessage;
  }
}

async function uploadToCloudinaryInChunks(file, resourceType, options = {}) {
  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`;
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let secureUrl = "";

  for (
    let chunkStart = 0;
    chunkStart < file.size;
    chunkStart += CLOUDINARY_UPLOAD_CHUNK_SIZE_BYTES
  ) {
    const chunkEnd = Math.min(chunkStart + CLOUDINARY_UPLOAD_CHUNK_SIZE_BYTES, file.size);
    const formData = new FormData();
    formData.append("file", file.slice(chunkStart, chunkEnd), file.name);
    formData.append("upload_preset", config.cloudinary.unsignedUploadPreset);
    formData.append("folder", config.cloudinary.folder || "luma-library");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Range": `bytes ${chunkStart}-${chunkEnd - 1}/${file.size}`,
        "X-Unique-Upload-Id": uploadId,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await parseCloudinaryError(response));
    }

    const data = await response.json();
    secureUrl = data.secure_url || secureUrl;

    if (typeof options.onProgress === "function") {
      options.onProgress(chunkEnd / file.size);
    }
  }

  if (!secureUrl) {
    throw new Error("Cloudinary upload finished without a file URL.");
  }

  return secureUrl;
}

async function uploadToCloudinary(file, resourceType, options = {}) {
  if (!config.cloudinary?.enabled) {
    return null;
  }

  if (resourceType === "raw" && file.size > CLOUDINARY_LARGE_UPLOAD_THRESHOLD_BYTES) {
    return uploadToCloudinaryInChunks(file, resourceType, options);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", config.cloudinary.unsignedUploadPreset);
  formData.append("folder", config.cloudinary.folder || "luma-library");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(await parseCloudinaryError(response));
  }

  const data = await response.json();
  if (typeof options.onProgress === "function") {
    options.onProgress(1);
  }
  return data.secure_url;
}

function setUploadStatus(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
  }
}

function updateSelectedFileStatus() {
  const coverFile = state.adminDraftFiles.cover || document.getElementById("bookCoverFile")?.files?.[0];
  const pdfFile = state.adminDraftFiles.pdf || document.getElementById("bookPdfFile")?.files?.[0];

  setUploadStatus(
    "coverUploadStatus",
    coverFile ? `Selected cover: ${coverFile.name} (${formatFileSize(coverFile.size)})` : "No cover file selected yet."
  );
  setUploadStatus(
    "pdfUploadStatus",
    pdfFile ? `Selected PDF: ${pdfFile.name} (${formatFileSize(pdfFile.size)})` : "No PDF file selected yet."
  );
}

function syncDraftFilesFromInputs() {
  const coverInputFile = document.getElementById("bookCoverFile")?.files?.[0] || null;
  const pdfInputFile = document.getElementById("bookPdfFile")?.files?.[0] || null;

  if (coverInputFile) {
    state.adminDraftFiles.cover = coverInputFile;
  }

  if (pdfInputFile) {
    state.adminDraftFiles.pdf = pdfInputFile;
  }
}

function clearAdminDraftFiles() {
  state.adminDraftFiles.cover = null;
  state.adminDraftFiles.pdf = null;
}

function hideAssetConfirmation() {
  const element = document.getElementById("assetConfirmation");
  if (!element) {
    return;
  }

  element.classList.add("hidden");
  element.innerHTML = "";
}

function renderAssetConfirmation(book) {
  const element = document.getElementById("assetConfirmation");
  if (!element) {
    return;
  }

  const hasAsset = Boolean(book?.pdfUrl || book?.coverUrl);
  if (!hasAsset) {
    hideAssetConfirmation();
    return;
  }

  element.innerHTML = `
    <strong>Saved asset links</strong>
    ${book.pdfUrl ? `<div>PDF: <a href="${escapeHtml(book.pdfUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(book.pdfUrl)}</a></div>` : ""}
    ${book.coverUrl ? `<div>Cover: <a href="${escapeHtml(book.coverUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(book.coverUrl)}</a></div>` : ""}
  `;
  element.classList.remove("hidden");
}

function isPdfFile(file) {
  if (!file) {
    return false;
  }

  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function assignFileToInput(input, file) {
  if (!input || !file) {
    return;
  }

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch (error) {
    // Some browsers do not allow programmatic assignment to file inputs.
  }
}

function setupPdfDropzone() {
  const dropzone = document.getElementById("pdfDropzone");
  const pdfInput = document.getElementById("bookPdfFile");

  if (!dropzone || !pdfInput) {
    return;
  }

  dropzone.addEventListener("click", () => {
    pdfInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];

    if (!isPdfFile(file)) {
      toast("Drop a PDF file here.");
      return;
    }

    state.adminDraftFiles.pdf = file;
    assignFileToInput(pdfInput, file);
    updateSelectedFileStatus();
    toast(`PDF selected: ${file.name}`);
  });
}

async function uploadSelectedAssets() {
  syncDraftFilesFromInputs();
  const coverFile = state.adminDraftFiles.cover;
  const pdfFile = state.adminDraftFiles.pdf;
  const coverUrlInput = document.getElementById("bookCoverUrl");
  const pdfUrlInput = document.getElementById("bookPdfUrl");

  if (!coverFile && !pdfFile) {
    toast("Choose a cover file or PDF file first.");
    return;
  }

  if (!config.cloudinary?.enabled) {
    toast("Cloudinary placeholders are still active. Add your Cloudinary config in config.js first.");
    return;
  }

  try {
    setUploadStatus("coverUploadStatus", coverFile ? `Uploading cover: ${coverFile.name}` : coverUrlInput.value ? "Using existing cover URL." : "No cover file selected yet.");
    setUploadStatus("pdfUploadStatus", pdfFile ? `Uploading PDF: ${pdfFile.name}` : pdfUrlInput.value ? "Using existing PDF URL." : "No PDF file selected yet.");

    if (coverFile) {
      coverUrlInput.value = await uploadToCloudinary(coverFile, "image");
      setUploadStatus("coverUploadStatus", `Cover uploaded: ${coverFile.name}`);
    }

    if (pdfFile) {
      pdfUrlInput.value = await uploadToCloudinary(pdfFile, "raw", {
        onProgress(progress) {
          const percent = Math.round(progress * 100);
          setUploadStatus(
            "pdfUploadStatus",
            `Uploading PDF: ${pdfFile.name} (${formatFileSize(pdfFile.size)}) ${percent}%`
          );
        },
      });
      setUploadStatus("pdfUploadStatus", `PDF uploaded: ${pdfFile.name}`);
    }

    updateSelectedFileStatus();
    toast("Selected files uploaded successfully.");
  } catch (error) {
    setUploadStatus("coverUploadStatus", coverFile ? `Cover upload failed for ${coverFile.name}.` : coverUrlInput.value ? "Using existing cover URL." : "No cover file selected yet.");
    setUploadStatus("pdfUploadStatus", pdfFile ? `PDF upload failed for ${pdfFile.name}.` : pdfUrlInput.value ? "Using existing PDF URL." : "No PDF file selected yet.");
    toast(error.message);
  }
}

async function handleBookFormSubmit(event) {
  event.preventDefault();

  const editingBookId = document.getElementById("editingBookId").value;
  const title = document.getElementById("bookTitle").value.trim();
  const author = document.getElementById("bookAuthor").value.trim();
  const description = document.getElementById("bookDescription").value.trim();
  const category = document.getElementById("bookCategory").value.trim();
  const type = document.getElementById("bookType").value;
  const priceInput = document.getElementById("bookPrice").value.trim();
  const currency = document.getElementById("bookCurrency").value.trim() || "USD";
  const coverUrlInput = document.getElementById("bookCoverUrl");
  const pdfUrlInput = document.getElementById("bookPdfUrl");
  syncDraftFilesFromInputs();
  const coverFile = state.adminDraftFiles.cover;
  const pdfFile = state.adminDraftFiles.pdf;
  let coverUrl = coverUrlInput.value.trim();
  let pdfUrl = pdfUrlInput.value.trim();
  const featured = document.getElementById("bookFeatured").checked;
  const published = document.getElementById("bookPublished").checked;
  const saveButton = document.getElementById("saveBookButton");

  if (!title || !author || !description) {
    toast("Title, author, and description are required.");
    return;
  }

  if (!pdfUrl && !pdfFile && !editingBookId) {
    toast("Add a PDF URL or choose a PDF file before saving.");
    return;
  }

  if ((coverFile || pdfFile) && !config.cloudinary?.enabled) {
    toast("Cloudinary upload is not ready yet. Add the real Cloudinary config in config.js or paste hosted URLs manually.");
    return;
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = coverFile || pdfFile ? "Uploading files..." : "Saving...";
    }

    if (coverFile) {
      setUploadStatus("coverUploadStatus", `Uploading cover: ${coverFile.name}`);
      coverUrl = await uploadToCloudinary(coverFile, "image");
      coverUrlInput.value = coverUrl;
      setUploadStatus("coverUploadStatus", `Cover uploaded: ${coverFile.name}`);
    } else if (coverUrl) {
      setUploadStatus("coverUploadStatus", "Using existing cover URL.");
    } else {
      setUploadStatus("coverUploadStatus", "No cover file selected yet.");
    }

    if (pdfFile) {
      setUploadStatus("pdfUploadStatus", `Uploading PDF: ${pdfFile.name}`);
      pdfUrl = await uploadToCloudinary(pdfFile, "raw", {
        onProgress(progress) {
          const percent = Math.round(progress * 100);
          setUploadStatus(
            "pdfUploadStatus",
            `Uploading PDF: ${pdfFile.name} (${formatFileSize(pdfFile.size)}) ${percent}%`
          );
        },
      });
      pdfUrlInput.value = pdfUrl;
      setUploadStatus("pdfUploadStatus", `PDF uploaded: ${pdfFile.name}`);
    } else if (pdfUrl) {
      setUploadStatus("pdfUploadStatus", "Using existing PDF URL.");
    } else {
      setUploadStatus("pdfUploadStatus", "No PDF file selected yet.");
    }

    let bookRecord = normalizeBookRecord({
      id: editingBookId || slugify(title),
      title,
      author,
      description,
      category,
      type,
      price: type === "free" ? "Free" : priceInput || "0.00",
      currency,
      featured,
      published,
      coverUrl,
      pdfUrl,
      pdfFileName: pdfFile ? pdfFile.name : pdfUrl ? pdfUrl.split("/").pop() : "",
      createdAt: editingBookId
        ? state.books.find((book) => book.id === editingBookId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    });

    if (editingBookId) {
      state.books = state.books.map((book) => (book.id === editingBookId ? bookRecord : book));
    } else {
      const duplicate = state.books.some((book) => book.id === bookRecord.id);
      if (duplicate) {
        bookRecord = {
          ...bookRecord,
          id: `${bookRecord.id}-${Date.now()}`,
        };
      }
      state.books = [bookRecord, ...state.books];
    }

    saveBooks();

    if (hasFirebaseClientConfig() && state.adminSession?.idToken) {
      await writeFirestoreDocument("books", bookRecord.id, bookRecord, state.adminSession);
      await syncBooksFromFirestore(true, state.adminSession);
    } else {
      saveBooks();
    }

    renderDashboardStats();
    renderAdminBookList();
    resetBookForm();
    renderAssetConfirmation(bookRecord);
    clearAdminDraftFiles();
    toast("Book saved successfully.");
  } catch (error) {
    toast(error.message || "Unable to save this book.");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save book";
    }
  }
}

async function loadPdfIntoReader(frame, pdfUrl) {
  if (!frame || !pdfUrl) {
    return false;
  }

  if (activeReaderPdfObjectUrl) {
    URL.revokeObjectURL(activeReaderPdfObjectUrl);
    activeReaderPdfObjectUrl = null;
  }

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error("Unable to load the PDF file.");
  }

  const pdfBlob = await response.blob();
  activeReaderPdfObjectUrl = URL.createObjectURL(pdfBlob);
  frame.src = activeReaderPdfObjectUrl;
  return true;
}

function renderReaderUnavailable(frameCard, book) {
  if (!frameCard || !book) {
    return;
  }

  frameCard.innerHTML = `
    <div class="empty-state">
      <h3>Reader file unavailable</h3>
      <p>
        The published reader cannot open this title because a production PDF URL has not been attached yet.
      </p>
      <p><strong>Book:</strong> ${escapeHtml(book.title)} by ${escapeHtml(book.author)}</p>
      <a class="primary-button button-link" href="./admin.html">Open admin dashboard</a>
    </div>
  `;
}

function revealDashboard() {
  const dashboard = document.getElementById("adminDashboard");
  if (!dashboard) {
    return;
  }

  dashboard.classList.remove("hidden");
  dashboard.classList.add("is-visible");
}

async function setupAdminPage() {
  renderIntegrationBanner("adminIntegrationBanner");

  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminLoginButton = document.getElementById("adminLoginButton");
  const adminLogoutButton = document.getElementById("adminLogoutButton");
  const resetCatalogCacheButton = document.getElementById("resetCatalogCacheButton");
  const bookForm = document.getElementById("bookForm");
  const bookCoverFileInput = document.getElementById("bookCoverFile");
  const bookPdfFileInput = document.getElementById("bookPdfFile");

  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("adminEmail").value.trim();
      const password = document.getElementById("adminPassword").value;

      if (!email || !password) {
        toast("Enter the admin email and password.");
        return;
      }

      if (!hasFirebaseAdminAuthConfig()) {
        toast("Firebase config is incomplete. Add the real Firebase values in config.js first.");
        return;
      }

      if (adminLoginButton) {
        adminLoginButton.disabled = true;
        adminLoginButton.textContent = "Checking access...";
      }

      try {
        const session = await signInWithFirebaseEmailPassword(email, password);
        const isAdmin = await verifyAdminAccess(session);

        if (!isAdmin) {
          updateAdminSession(null);
          toast("This account signed in, but it is not an admin account.");
          return;
        }

        updateAdminSession(session);
        try {
          await syncBooksFromFirestore(true, session);
        } catch (error) {
          // Keep local books if Firestore is not ready yet.
        }
        try {
          await syncAdminTransferRequests();
        } catch (error) {
          state.adminTransferRequests = [];
        }
        revealDashboard();
        renderDashboardStats();
        renderAdminBookList();
        renderAdminTransferRequests();
        toast("Admin access granted.");
      } catch (error) {
        updateAdminSession(null);
        toast(formatFirebaseAuthError(error.message || "Unable to sign in."));
      } finally {
        if (adminLoginButton) {
          adminLoginButton.disabled = false;
          adminLoginButton.textContent = "Continue to dashboard";
        }
      }
    });
  }

  try {
    await restoreAdminAccess();
  } catch (error) {
    updateAdminSession(null);
  }

  if (adminLogoutButton) {
    adminLogoutButton.addEventListener("click", () => {
      updateAdminSession(null);
      window.location.reload();
    });
  }

  if (resetCatalogCacheButton) {
    resetCatalogCacheButton.addEventListener("click", () => {
      const confirmed = window.confirm("Reset the locally cached catalog and purchase data on this device?");
      if (!confirmed) {
        return;
      }

      state.books = [...DEFAULT_BOOKS];
      saveBooks();
      updatePurchases([]);
      state.adminTransferRequests = [];
      renderDashboardStats();
      renderAdminBookList();
      renderAdminTransferRequests();
      resetBookForm();
      toast("Local cache reset on this device.");
    });
  }

  if (bookCoverFileInput) {
    bookCoverFileInput.addEventListener("change", () => {
      syncDraftFilesFromInputs();
      updateSelectedFileStatus();
    });
  }

  if (bookPdfFileInput) {
    bookPdfFileInput.addEventListener("change", () => {
      syncDraftFilesFromInputs();
      updateSelectedFileStatus();
    });
  }

  if (bookForm) {
    bookForm.addEventListener("submit", handleBookFormSubmit);
  }

  setupPdfDropzone();
  updateSelectedFileStatus();
  renderDashboardStats();
  renderAdminBookList();
  renderAdminTransferRequests();
}

async function setupReaderPage() {
  const root = document.getElementById("readerRoot");
  if (!root) {
    return;
  }

  await restoreReaderAccess();
  try {
    await syncBooksFromFirestore(false);
  } catch (error) {
    // Keep local books if Firestore is not ready yet.
  }
  try {
    await syncReaderPurchases();
  } catch (error) {
    // Keep local purchases if Firestore is not ready yet.
  }
  renderSignedInChrome();
  setupPublicModalsAndActions();

  const params = new URLSearchParams(window.location.search);
  const bookId = params.get("id");
  const book = state.books.find((item) => item.id === bookId && item.published);

  const title = document.getElementById("readerTitle");
  const description = document.getElementById("readerDescription");
  const meta = document.getElementById("readerMeta");
  const accessCard = document.getElementById("readerAccessCard");
  const frame = document.getElementById("readerFrame");
  const frameCard = document.getElementById("readerFrameCard");

  if (!book) {
    title.textContent = "Book not found";
    description.textContent = "This book does not exist or is not published.";
    accessCard.innerHTML = `
      <p class="card-label">Reader status</p>
      <h3>Nothing to open</h3>
      <p>Return to the library and choose a published title.</p>
      <a class="primary-button button-link" href="./index.html">Back to library</a>
    `;
    frameCard.classList.add("hidden");
    return;
  }

  title.textContent = book.title;
  description.textContent = book.description;
  meta.innerHTML = `
    <span>${book.author}</span>
    <span>${book.category || "General"}</span>
    <span>${formatPrice(book)}</span>
  `;

  if (!state.session) {
    accessCard.innerHTML = `
      <p class="card-label">Access locked</p>
      <h3>Log in to read this book</h3>
      <p>You can browse the library while signed out, but the reader only opens for logged-in users.</p>
      <a class="primary-button button-link" href="./index.html">Go to library</a>
    `;
    frameCard.classList.add("hidden");
    return;
  }

  if (!canAccessBook(book)) {
    accessCard.innerHTML = `
      <p class="card-label">Access locked</p>
      <h3>${book.type === "free" ? "Your session is required" : "Unlock this book first"}</h3>
      <p>
        ${book.type === "free"
          ? "Log in with your reader account from the library, then reopen this book."
          : "Return to the library and complete the Wema transfer flow before opening the premium reader."}
      </p>
      <a class="primary-button button-link" href="./index.html">Return to library</a>
    `;
    frameCard.classList.add("hidden");
    return;
  }

  accessCard.innerHTML = `
    <p class="card-label">Access granted</p>
    <h3>Reader unlocked</h3>
    <p>${book.pdfUrl ? "The PDF is connected and loading below." : "This title cannot open until a production PDF URL is attached in the admin dashboard."}</p>
  `;

  if (!book.pdfUrl) {
    renderReaderUnavailable(frameCard, book);
    return;
  }

  try {
    await loadPdfIntoReader(frame, book.pdfUrl);
    accessCard.innerHTML = `
      <p class="card-label">Access granted</p>
      <h3>Reader unlocked</h3>
      <p>The uploaded PDF is ready below. If your browser blocks the embedded viewer, open it in a new tab.</p>
      <a class="ghost-button button-link" href="${escapeHtml(book.pdfUrl)}" target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
    `;
  } catch (error) {
    frameCard.innerHTML = `
      <div class="empty-state">
        <h3>PDF could not load inside the page</h3>
        <p>The book file exists, but this browser could not embed it here. Open it directly instead.</p>
        <a class="primary-button button-link" href="${escapeHtml(book.pdfUrl)}" target="_blank" rel="noopener noreferrer">Open PDF</a>
      </div>
    `;
  }
}

function setupRevealAnimation() {
  const revealElements = document.querySelectorAll(".reveal");
  if (!revealElements.length || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealElements.forEach((element) => observer.observe(element));
}

function init() {
  if (page === "home") {
    void buildPublicPage();
  }

  if (page === "admin") {
    void setupAdminPage();
  }

  if (page === "reader") {
    void setupReaderPage();
  }

  setupRevealAnimation();
}

init();
