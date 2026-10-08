// The Worker's bindings. `Cloudflare.Env` is also what `env` from "cloudflare:workers" is typed as
// (used in worker tests). VIEW_SECRET and PEOPLE are Worker secrets, never in wrangler.toml.
declare namespace Cloudflare {
  interface Env {
    BOARD: DurableObjectNamespace<import('./board').Board>;
    VIEW_SECRET: string;
    PEOPLE: string;
  }
}

// Vite "?raw" imports, used by tests to scan source files as text.
declare module '*?raw' {
  const content: string;
  export default content;
}
