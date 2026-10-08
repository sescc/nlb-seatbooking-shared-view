// Pieces shared by the bookmarklet and the userscript (both run on NLB's page, in the user's browser).

// Same-origin, read-only. The push clients never call any NLB write endpoint.
export const ACCOUNT_API = '/seatbooking/api/accounts/GetAccountInfo';

export function pushUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/push/${encodeURIComponent(token)}`;
}

// True when `info` looks like a logged-in account: an object with a bookings array.
// (A partial/empty object must never be pushed: it would clear the person's lane.)
export function hasBookings(info: unknown): info is { bookings: unknown[] } {
  return typeof info === 'object' && info !== null && Array.isArray((info as { bookings?: unknown }).bookings);
}

const MESSAGE_ID = 'nlbsv-message';

// A transient toast on the NLB page (userscript only). NLB's CSP blocks style attributes and <style>
// tags, so every style goes through the CSSOM (element.style.x = ...), and text through textContent.
export function showMessage(doc: Document, text: string, opts: { corner?: boolean; ms?: number } = {}): void {
  doc.getElementById(MESSAGE_ID)?.remove();
  const el = doc.createElement('div');
  el.id = MESSAGE_ID;
  el.textContent = text;
  const s = el.style;
  s.position = 'fixed';
  s.zIndex = '2147483647';
  s.boxSizing = 'border-box';
  s.padding = '12px 16px';
  s.background = '#1f2937';
  s.color = '#ffffff';
  s.fontFamily = 'system-ui, sans-serif';
  s.fontSize = '16px';
  s.borderRadius = '8px';
  s.cursor = 'pointer';
  if (opts.corner) {
    s.right = '16px';
    s.bottom = '16px';
  } else {
    s.top = '16px';
    s.left = '50%';
    s.transform = 'translateX(-50%)';
  }
  el.onclick = () => el.remove();
  doc.body.appendChild(el);
  setTimeout(() => el.remove(), opts.ms ?? 4000);
}
