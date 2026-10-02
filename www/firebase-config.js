// Paste your Firebase web app config here to turn on login and cloud sync.
// Firebase console -> Project settings -> Your apps -> Web app -> SDK setup and configuration -> Config.
// While this is null the app runs in guest mode and keeps data on the device only.
window.FF_FIREBASE_CONFIG = null;

/* Example:
window.FF_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123",
};
*/

// How players reach you for a login. Shown on the login page and on every locked tool.
// Example: { label: "WhatsApp", value: "+92 300 1234567", href: "https://wa.me/923001234567" }
window.FF_ADMIN_CONTACT = { label: "", value: "", href: "" };
