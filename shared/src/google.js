// Admins sign in with Google on the site. The browser sends the Google ID token with every
// admin call; the server checks it with Google and looks the address up in AdminUsers.
// The client ID is public (it's in every sign-in page), not a secret.
export const GOOGLE_CLIENT_ID =
  '967060231980-vs7tjc1u1ucjv0tuo2a4qhcvom0k8vt4.apps.googleusercontent.com'
export const GOOGLE_ISSUERS = Object.freeze(['accounts.google.com', 'https://accounts.google.com'])
