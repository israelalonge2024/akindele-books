window.APP_CONFIG = {
  app: {
    name: "Soul Lesson Library",
    mode: "demo",
  },
  firebase: {
    enabled: true,
    apiKey: "AIzaSyB-6zqA9gpvOKKD9xI36wWwHLKbvUU0qok",
    authDomain: "luna-library-c71ab.firebaseapp.com",
    projectId: "luna-library-c71ab",
    storageBucket: "luna-library-c71ab.firebasestorage.app",
    messagingSenderId: "801185368883",
    appId: "1:801185368883:web:876dbb3d4c612529be4c46",
  },

  cloudinary: {
    enabled: true,
    cloudName: "duyjt8xlp",
    unsignedUploadPreset: "luma-library",
    folder: "luma-library",
  },
  flutterwave: {
    enabled: true,
    checkoutEndpoint: "/.netlify/functions/initialize-flutterwave",
    verificationEndpoint: "/.netlify/functions/verify-flutterwave-transaction",
  },
  admin: {
    hiddenRoute: "/admin.html",
  },
};
