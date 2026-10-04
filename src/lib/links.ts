// Public pages required for the Play Store listing. The HTML for them is in docs/ (ready for GitHub
// Pages: repo Settings → Pages → branch main, folder /docs). Set EXPO_PUBLIC_LEGAL_URL to where they
// are published, e.g. https://<github-user>.github.io/<repo>
const BASE = (process.env.EXPO_PUBLIC_LEGAL_URL ?? '').replace(/\/+$/, '');

export const legalReady = BASE.length > 0;
export const PRIVACY_URL = `${BASE}/privacy.html`;
export const TERMS_URL = `${BASE}/terms.html`;
export const DELETE_ACCOUNT_URL = `${BASE}/delete-account.html`;
