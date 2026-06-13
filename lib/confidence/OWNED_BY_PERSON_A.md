# OWNED BY PERSON A — `/lib/confidence`

The layered confidence math (gene prior → variant effect → mechanism gate →
cross-species → overall). Part of the **research engine**.

**Person B (frontend / UI / voice) must NOT create or edit files here.**

The frontend renders confidence only via the shared `ConfidencePipelineState`
shape in `/lib/types.ts`. The UI never computes confidence — it displays what
Person A publishes. If a value is missing or `null`, render it as pending.

See `/CLAUDE.md` → Merge discipline.
