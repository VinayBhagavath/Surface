// Inngest serve endpoint. The Inngest dev server (and Inngest Cloud) introspect
// and invoke functions through here. Run `npm run inngest` alongside `npm run dev`.

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
