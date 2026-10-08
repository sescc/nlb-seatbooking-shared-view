// Globals available to the push clients. The origin and token are bound by the Worker's /setup
// templating (as function parameters wrapping the bundle), never stored in this repository.
declare const __NLBSV_ORIGIN__: string;
declare const __NLBSV_TOKEN__: string;

// Violentmonkey / Tampermonkey (granted in the userscript header).
interface GmRequestDetails {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  data: string;
  timeout?: number;
  onload: (response: { status: number }) => void;
  onerror: () => void;
  ontimeout: () => void;
}
declare function GM_xmlhttpRequest(details: GmRequestDetails): unknown;
declare const unsafeWindow: Window & typeof globalThis;
