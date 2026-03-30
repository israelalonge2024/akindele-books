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
  adminDraftFiles: {
    cover: null,
    pdf: null,
  },
};

let activeReaderPdfObjectUrl = null;

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

  const userDoc = await getAdminUserDocument(session.localId, session.idToken);
  const fields = userDoc?.fields || {};
  const role = getFirestoreFieldValue(fields.role);
  const admin = getFirestoreFieldValue(fields.admin);
  return role === "admin" || admin === true;
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

async function queryUserPurchases(session) {
  const response = await fetch(`${getFirestoreBaseUrl()}:runQuery`, {
    method: "POST",
    headers: getFirestoreHeaders(session),
    body: JSON.stringify({
      structuredQuery: {
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
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to load purchases.");
  }

  return (Array.isArray(data) ? data : [])
    .map((entry) => entry.document)
    .filter(Boolean)
    .map(fromFirestoreDocument)
    .filter((purchase) => purchase.status === "paid");
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
    revealDashboard();
    renderDashboardStats();
    renderAdminBookList();
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
    flutterwave: Boolean(config.flutterwave && config.flutterwave.enabled),
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
    { label: "Flutterwave", active: flags.flutterwave },
  ];

  container.innerHTML = `
    <div class="status-banner-copy">
      <strong>${config.app?.mode === "demo" ? "Setup still in progress." : "Live config detected."}</strong>
      <span>
        ${config.app?.mode === "demo"
          ? "Firebase, Cloudinary, and Flutterwave can be connected step by step from the project guides."
          : "Config values were detected. Finish your backend wiring and security rules before launch."}
      </span>
    </div>
    <div class="status-pill-row">
      ${items
        .map(
          (item) => `
            <span class="status-pill ${item.active ? "active" : ""}">
              ${item.label}: ${item.active ? "connected" : "not connected"}
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
      <button class="payment-button" type="button" data-payment="flutterwave">
        Pay with Flutterwave
      </button>
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
      renderSignedInChrome();
      renderPublicBooks();

      if (page === "reader") {
        window.location.href = "./index.html";
        return;
      }

      toast("You have been logged out.");
    }

    if (target.dataset.payment === "flutterwave") {
      await handlePayment("flutterwave");
    }
  });
}

async function handlePayment(provider) {
  const book = state.activeBook;
  if (!book) {
    return;
  }

  if (!state.session) {
    openAuthModal("signin");
    return;
  }

  const providerConfig = config[provider];
  if (!providerConfig || !providerConfig.enabled) {
    toast("Flutterwave is not connected yet. Add your Flutterwave and Netlify values first.");
    return;
  }

  try {
    const response = await postJson(providerConfig.checkoutEndpoint, {
      bookId: book.id,
      userId: state.session.localId,
      customerEmail: state.session.email,
      customerName: state.session.name || state.session.email,
    });

    if (!response.link) {
      throw new Error("Flutterwave checkout link was not returned.");
    }

    window.location.href = response.link;
  } catch (error) {
    toast(error.message || "Unable to start Flutterwave checkout.");
  }
}

function clearFlutterwaveQueryParams() {
  const url = new URL(window.location.href);
  [
    "payment",
    "status",
    "tx_ref",
    "transaction_id",
    "transactionId",
    "flw_tx_id",
  ].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, url.toString());
}

async function handleFlutterwaveReturn() {
  if (!config.flutterwave?.enabled) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const txRef = params.get("tx_ref");
  const status = String(params.get("status") || "").toLowerCase();
  const transactionId =
    params.get("transaction_id") ||
    params.get("transactionId") ||
    params.get("flw_tx_id");

  if (!txRef && !transactionId) {
    return;
  }

  if (status === "cancelled") {
    clearFlutterwaveQueryParams();
    toast("Payment was cancelled before completion.");
    return;
  }

  if (!txRef || !transactionId) {
    clearFlutterwaveQueryParams();
    toast("Flutterwave returned incomplete payment details.");
    return;
  }

  try {
    const response = await postJson(config.flutterwave.verificationEndpoint, {
      txRef,
      transactionId,
    });

    if (response?.purchase) {
      const purchases = state.purchases.filter((purchase) => purchase.txRef !== response.purchase.txRef);
      updatePurchases([...purchases, response.purchase]);
    }

    try {
      await syncReaderPurchases();
    } catch (error) {
      // Keep the verified purchase locally if Firestore reads are not ready yet.
    }
    closeDialog("bookModal");
    clearFlutterwaveQueryParams();
    renderPublicBooks();

    const purchasedBookId = response?.purchase?.bookId;
    if (purchasedBookId) {
      toast("Payment verified. Your book is now unlocked.");
      window.location.href = `./reader.html?id=${encodeURIComponent(purchasedBookId)}`;
      return;
    }

    toast("Payment verified successfully.");
  } catch (error) {
    clearFlutterwaveQueryParams();
    toast(error.message || "Flutterwave payment verification failed.");
  }
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
  await handleFlutterwaveReturn();
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
  const featured = state.books.filter((book) => book.featured).length;

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
      <span>Featured</span>
      <strong>${featured}</strong>
    </article>
  `;
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

async function uploadToCloudinary(file, resourceType) {
  if (!config.cloudinary?.enabled) {
    return null;
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
    throw new Error("Cloudinary upload failed.");
  }

  const data = await response.json();
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
    coverFile ? `Selected cover: ${coverFile.name}` : "No cover file selected yet."
  );
  setUploadStatus(
    "pdfUploadStatus",
    pdfFile ? `Selected PDF: ${pdfFile.name}` : "No PDF file selected yet."
  );
}

function syncDraftFilesFromInputs() {
  state.adminDraftFiles.cover = document.getElementById("bookCoverFile")?.files?.[0] || null;
  state.adminDraftFiles.pdf = document.getElementById("bookPdfFile")?.files?.[0] || null;
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
      pdfUrlInput.value = await uploadToCloudinary(pdfFile, "raw");
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
      pdfUrl = await uploadToCloudinary(pdfFile, "raw");
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
  const resetDemoDataButton = document.getElementById("resetDemoDataButton");
  const bookForm = document.getElementById("bookForm");
  const bookCoverFileInput = document.getElementById("bookCoverFile");
  const bookPdfFileInput = document.getElementById("bookPdfFile");

  await restoreAdminAccess();

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
          revealDashboard();
          renderDashboardStats();
          renderAdminBookList();
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

  if (adminLogoutButton) {
    adminLogoutButton.addEventListener("click", () => {
      updateAdminSession(null);
      window.location.reload();
    });
  }

  if (resetDemoDataButton) {
    resetDemoDataButton.addEventListener("click", () => {
      const confirmed = window.confirm("Reset local fallback books and purchases on this device?");
      if (!confirmed) {
        return;
      }

      state.books = [...DEFAULT_BOOKS];
      saveBooks();
      updatePurchases([]);
      renderDashboardStats();
      renderAdminBookList();
      resetBookForm();
      toast("Local fallback data restored.");
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
          : "Return to the library and complete checkout before opening the premium reader."}
      </p>
      <a class="primary-button button-link" href="./index.html">Return to library</a>
    `;
    frameCard.classList.add("hidden");
    return;
  }

  accessCard.innerHTML = `
    <p class="card-label">Access granted</p>
    <h3>Reader unlocked</h3>
    <p>${book.pdfUrl ? "The PDF is connected and loading below." : "Add the real PDF URL in the admin dashboard or config-linked storage."}</p>
  `;

  if (!book.pdfUrl) {
    frameCard.innerHTML = `
      <div class="empty-state">
        <h3>PDF URL missing</h3>
        <p>Add the final PDF URL from the admin dashboard, then reopen this reader page.</p>
      </div>
    `;
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
