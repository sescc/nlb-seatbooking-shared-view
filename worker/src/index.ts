// Entry point. All routing and the response guard live in router.ts.
import { handle } from './router';
import type { Env } from './config';

export { Board } from './board';

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handle(request, env, Date.now()),
} satisfies ExportedHandler<Env>;
