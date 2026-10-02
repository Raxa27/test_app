// Paste your Firebase web app config here to turn on login and cloud sync.
// Firebase console -> Project settings -> Your apps -> Web app -> SDK setup and configuration -> Config.
// While this is null, only the built-in accounts below can log in, and their data stays on the device.
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

// Built-in accounts that work without Firebase (data stays on the device; no cloud sync).
// Passwords are stored as SHA-256 hashes. To add or change one, get the hash of the new password
// (for example: echo -n 'newpassword' | sha256sum) and put it in "sha256".
// The page code is public, so use long passwords here and move members to Firebase when you can.
window.FF_LOCAL_ACCOUNTS = [
  { username: "admin", name: "Admin", sha256: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9" },
];
