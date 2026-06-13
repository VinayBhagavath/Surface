// /inngest/client.ts
// SHARED — keep identical to Person A. Minimal Inngest client.
//
// CROSS-TEAM ⚠ DEVIATION FROM SPEC — inngest major version. The spec wires
// realtimeMiddleware() from "@inngest/realtime" into the client. That does NOT work with the
// versions `pnpm add inngest @inngest/realtime` installs today:
//   • inngest@4.5.1 has Realtime built in (import channel/subscribe/getSubscriptionToken from
//     "inngest/realtime"); it exposes publish() in the function context and needs NO realtime
//     middleware. inngest core exports no `realtimeMiddleware`.
//   • @inngest/realtime@0.4.7 is built for inngest v3 (its dependency is inngest@^3.42.3); its
//     realtimeMiddleware() is type-incompatible with inngest@4's `middleware: Middleware.Class[]`.
// → The v4-correct client is just `new Inngest({ id })` (below).
//
// ACTION FOR PERSON A — agree on the inngest major version:
//   - Staying on inngest v4 (current, recommended): publish from your functions via the
//     built-in realtime API (channel()/publish()/step.publish), NOT the standalone middleware.
//   - If you are on inngest v3 + @inngest/realtime: tell Person B and we'll pin v3 and restore
//     the spec's `middleware: [realtimeMiddleware()]` here.
// Person B's subscribe side (Step 9) uses inngest@4's built-in "inngest/realtime".
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "vus-resolver",
});
