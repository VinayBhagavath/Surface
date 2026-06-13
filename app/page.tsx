import { DEMO_VARIANTS } from "@/lib/demo-variants";
import { storeMode } from "@/lib/store";
import { hasXai } from "@/lib/env";

// NOTE: placeholder dev/status page. Person B replaces this with the real intake
// route (`/`) per the architecture. It exists so the backend half is runnable
// and verifiable on its own, and so the team can fire test runs without the UI.

export default function Home() {
  const xai = hasXai();
  const mode = storeMode();
  return (
    <main className="wrap">
      <span className="pill">Research engine — Person A</span>
      <h1>VUS Resolver</h1>
      <p className="muted">
        Backend status page. The research engine (connectors → Inngest pipeline →
        Grok reasoning → layered confidence → Watcher) is live. Person B&apos;s UI
        mounts on top of the same contract in <code>lib/types.ts</code>.
      </p>

      <div className="card">
        <strong>Environment</strong>
        <ul>
          <li>Grok (xAI) key: {xai ? "✅ configured" : "❌ missing — set XAI_API_KEY"}</li>
          <li>Run-output store: <code>{mode}</code> {mode === "memory" ? "(set KV_REST_API_URL for prod)" : ""}</li>
        </ul>
      </div>

      <div className="card">
        <strong>Fire a demo run</strong>
        <p className="muted">
          Start the Inngest dev server first: <code>npm run inngest</code> (and <code>npm run dev</code>).
        </p>
        <div>
          {DEMO_VARIANTS.map((d) => (
            <a className="btn" key={d.id} href={`/api/test-trigger?demo=${d.id}`}>
              {d.id.toUpperCase()} →
            </a>
          ))}
        </div>
        <p className="muted">
          Each returns a <code>runId</code> + realtime token URL. Subscribe to{" "}
          <code>vus-run-&#36;&#123;runId&#125;</code> (topic <code>events</code>) for the live trajectory,
          and read the brief at <code>/api/brief/&#36;&#123;runId&#125;</code>.
        </p>
      </div>

      <div className="card">
        <strong>Handoff to Person B</strong>
        <ul>
          <li>Contract types: <code>lib/types.ts</code></li>
          <li>Captured fixtures: <code>fixtures/&#42;-run.json</code>, <code>fixtures/&#42;-output.json</code></li>
          <li>Realtime token route: <code>/api/realtime-token?runId=…</code></li>
          <li>Docs: <code>docs/HANDOFF.md</code>, <code>docs/CONTRACT.md</code>, <code>CLAUDE.md</code></li>
        </ul>
      </div>
    </main>
  );
}
