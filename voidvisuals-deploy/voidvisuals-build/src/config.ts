// Site-wide constants. Everything here is public by design (it ships in the browser bundle).

export const BRAND = 'VoidVisuals';
export const BRAND_LONG = 'VoidVisuals Studio';

// Studio contact channels. The brief form is the primary path; these are the fallbacks.
export const CONTACT_EMAIL = 'voidvisuals999@gmail.com';
export const CONTACT_PHONE = '+91 89203 68725';
export const WHATSAPP_URL = 'https://wa.me/918920368725?text=Hi%20VoidVisuals%2C%20I%20want%20a%20website.';
export const INSTAGRAM_URL = 'https://instagram.com/voidvisuals';
export const BEHANCE_URL = '';

// Current origin, so the same bundle works on workers.dev, pages.dev or a custom domain.
export const SITE_ORIGIN =
  typeof window === 'undefined' ? 'https://voidvisuals.pages.dev' : window.location.origin;

export const IST_LABEL = 'IST (UTC+5:30)';
