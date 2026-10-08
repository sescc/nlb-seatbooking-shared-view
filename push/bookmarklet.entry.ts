// esbuild entry for the bookmarklet bundle. The Worker's /setup wraps the bundle in a function that
// binds __NLBSV_ORIGIN__ and __NLBSV_TOKEN__, so this repository holds neither.
// (A separate entry file, so bookmarklet.ts stays importable by tests with no auto-run guard bytes.)
import { runBookmarklet } from './bookmarklet';

void runBookmarklet(__NLBSV_ORIGIN__, __NLBSV_TOKEN__, document, fetch, alert);
