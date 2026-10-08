// Bookmarklet realisation of the push client (T1: form POST). Runs on the NLB "My Bookings" page.
// It must stay TINY: Android Chrome hard-truncates long bookmark URLs, so the served bookmarklet
// (this bundle + origin + token) has to fit in 1,000 bytes. Hence: no Vuex fallback, no overlay,
// no `extract` (the server runs it), and alert() for the one failure message.
//
// NLB's CSP blocks cross-origin fetch/sendBeacon, so the rows travel in a dynamically built
// <form method=POST target=_blank> (the CSP has no form-action directive).
// Only whitelisted keys of each row leave the page (NLB_ROW_KEYS via trimRow); profile data never does.
import { trimRow } from '../shared/src/booking';
import { ACCOUNT_API } from './common';

export const LOGIN_MESSAGE = 'Log in to NLB first';

// Positional parameters (not an options object) so the minifier can shorten every name.
export function runBookmarklet(
  origin: string,
  token: string,
  doc: Document,
  fetchFn: typeof fetch,
  alertFn: (message: string) => void,
): Promise<void> {
  return fetchFn(ACCOUNT_API, { credentials: 'include' })
    .then((r) => r.json())
    .then((d: { accountInfo: { bookings: unknown[] } }) => {
      // Throws (-> the catch below) when logged out: accountInfo or bookings is missing.
      const rows = d.accountInfo.bookings.map(trimRow);
      const form = doc.createElement('form');
      const field = doc.createElement('input');
      form.method = 'POST';
      form.action = origin + '/push/' + token;
      form.target = '_blank';
      form.acceptCharset = 'utf-8';
      field.name = 'rows';
      field.value = JSON.stringify(rows);
      form.appendChild(field);
      doc.body.appendChild(form);
      form.submit();
      form.remove();
    })
    .catch(() => alertFn(LOGIN_MESSAGE));
}
