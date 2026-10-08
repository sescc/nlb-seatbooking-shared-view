# NLB probe spike (s1)

A throwaway bookmarklet that checks, on the real NLB site, three things:

- (a) whether Chrome runs a `javascript:` bookmarklet on the CSP-protected page;
- (b) whether a same-origin call to `GetAccountInfo` returns the bookings;
- (c) the real shape of a seat booking versus a room booking, and whether the Vuex store is reachable as a fallback.

It only makes one same-origin GET to `/seatbooking/api/accounts/GetAccountInfo`. It sends nothing anywhere else.
The report it shows is redacted: booking reference digits become `#`, `infoJson` and `areaInformation` are reduced to key names, image URLs become counts, and profile fields are never included (only their key names).

## Files

- `s1-probe.js`: readable source.
- `s1-bookmarklet.txt`: the one-line `javascript:` URL to paste as a bookmark URL. Rebuild with `node spike/build.mjs` after editing the source.

## Add the bookmark

Desktop Chrome:

1. Show the bookmarks bar (Ctrl+Shift+B), right-click it, choose "Add page...".
2. Name: `nlbprobe`. URL: paste the entire contents of `s1-bookmarklet.txt` (it starts with `javascript:`).
3. Save.

Android Chrome:

1. Bookmark any page (menu, star icon).
2. Menu, Bookmarks, long-press the new bookmark, Edit. Name it `nlbprobe` and replace the URL with the pasted contents of `s1-bookmarklet.txt`. Save.
3. Chrome sometimes drops the `javascript:` prefix when you paste into the address bar. That does not matter for the bookmark edit field; just check the URL still starts with `javascript:` after saving.

## Run it

1. Open https://www.nlb.gov.sg/seatbooking/ and log in.
2. Go to the My Bookings page. For the best result, have at least one seat booking and, if you can, one room booking (and a day pass).
3. Desktop: click the `nlbprobe` bookmark.
   Android: type `nlbprobe` in the address bar and tap the bookmark suggestion (not a search suggestion).
4. An alert saying "NLB probe running" should appear. Dismiss it. If you see this alert, the bookmarklet runs; that already answers (a).
5. A full-screen overlay with a text box appears. Tap Copy (or select the text manually) and close it with Close.

## What to send back

- Paste the whole text from the overlay.
- Say whether the "NLB probe running" alert appeared. If nothing happened at all, say so, and whether it was desktop or Android.
- If the overlay shows an `error`/`stage` instead of a report, send that too.

## Interpreting results

1. If NO "NLB probe running" alert appears after tapping the bookmark, Chrome blocked the bookmarklet (most likely NLB's CSP). Report "no alert", plus desktop or Android. Also open the DevTools Console on desktop and copy any red CSP error line.
2. If the alert appears but the overlay shows a fetch status of 400, 401 or 403, still copy the whole overlay text.
3. Check the overlay text before sending: it should contain no name, email or membership number. If it does, don't send it; say which field leaked.
