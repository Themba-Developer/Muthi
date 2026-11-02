import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // A standalone Workers preview has no Sites authentication gateway.
    // Never accept identity headers supplied by a public caller there.
    if ((env as unknown as Record<string,string>).DIRECT_PREVIEW === 'true') {
      const url = new URL(request.url);
      if (['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname)) {
        return Response.redirect(new URL('/login', request.url).href, 302);
      }
      const safeHeaders = new Headers(request.headers);
      for (const name of [...safeHeaders.keys()]) {
        if (name.toLowerCase().startsWith('oai-')) safeHeaders.delete(name);
      }
      request = new Request(request, { headers: safeHeaders });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
