import { AgentMail } from "@agentmail/convex";
import { httpRouter } from "convex/server";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.email.onMessageReceived,
});

const http = httpRouter();

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(
    async (ctx, request) =>
      await agentmail.handleWebhook(
        ctx as unknown as Parameters<AgentMail["handleWebhook"]>[0],
        request,
      ),
  ),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(() =>
    Promise.resolve(Response.json({ service: "noticeproof", status: "ok", version: "0.1.0" })),
  ),
});

export default http;
