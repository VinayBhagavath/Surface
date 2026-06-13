# OWNED BY PERSON A — `/lib/connectors`

API connectors (Ensembl VEP, gnomAD, MyVariant, conservation, DIOPT, IMPC,
Monarch). Part of the **research engine**.

**Person B (frontend / UI / voice) must NOT create or edit files here.**

If the frontend needs data from a connector, consume it only through the shared
contract in `/lib/types.ts` (an `EvidenceFragment`). Do not import from this
directory and do not implement connector logic. If you think you need something
here, stub it behind the shared types with a `// PERSON A:` note instead.

See `/CLAUDE.md` → Merge discipline.
