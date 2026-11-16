import { captureException, installConsoleCapture } from "@/lib/monitoring";

/** Runs once when a server instance starts (Node and Edge). Error monitoring is a no-op until SENTRY_DSN is set. */
export function register() {
  installConsoleCapture();
}

/** Next calls this for every uncaught server error: pages, server actions, route handlers and the proxy. */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  await captureException(err, {
    request: { url: request.path, method: request.method },
    tags: { source: "request", routePath: context.routePath, routeType: context.routeType, routerKind: context.routerKind },
  });
}
