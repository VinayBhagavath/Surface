// Literature search connector — Europe PMC REST API (keyless, public).
//
// Adds a real scholarly-literature pass alongside the genomic-database
// connectors: given a gene + the patient's condition, it finds recent peer-
// reviewed papers so Grok can ground its reasoning/summary in actual published
// research rather than database records alone. Same contract as the other
// connectors: throws only on a genuine HTTP failure; an empty real result is
// `found: false`, never fabricated.

import { fetchJson, qs } from "@/lib/http";

const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export type LiteraturePaper = {
  title: string;
  journal: string | null;
  year: string | null;
  authors: string | null;
  pmid: string | null;
  doi: string | null;
  url: string | null;
};

export type LiteratureResult = {
  found: boolean;
  count: number; // total hit count reported by Europe PMC
  query: string;
  papers: LiteraturePaper[];
};

type EpmcResult = {
  id?: string;
  source?: string;
  pmid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
};
type EpmcResponse = {
  hitCount?: number;
  resultList?: { result?: EpmcResult[] };
};

function cleanTitle(t: string): string {
  return t
    .replace(/&lt;/g, "<") // decode entities FIRST so markup becomes real tags
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "") // then strip inline markup tags (<i>, <sup>, …)
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
}

function paperUrl(r: EpmcResult): string | null {
  if (r.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`;
  if (r.doi) return `https://doi.org/${r.doi}`;
  if (r.source && r.id) return `https://europepmc.org/article/${r.source}/${r.id}`;
  return null;
}

export async function searchLiterature(input: {
  geneSymbol: string;
  condition?: string | null;
  limit?: number;
}): Promise<LiteratureResult> {
  const limit = input.limit ?? 4;
  const gene = input.geneSymbol.trim();
  const condition = (input.condition ?? "").trim();

  // Require the gene in the title/abstract (keeps results gene-specific rather
  // than broad reviews), narrow to variant/mechanism papers, and let Europe PMC
  // rank by relevance.
  const terms = [`(TITLE:"${gene}" OR ABSTRACT:"${gene}")`];
  if (condition) terms.push(`("${condition}")`);
  terms.push("(variant OR mutation OR missense OR pathogenic OR phenotype OR function)");
  const query = terms.join(" AND ");

  const url =
    EUROPE_PMC +
    qs({
      query,
      format: "json",
      pageSize: limit,
      resultType: "lite",
    });

  const resp = await fetchJson<EpmcResponse>(url, { timeoutMs: 15_000, retries: 1 });
  const results = resp.resultList?.result ?? [];
  const papers: LiteraturePaper[] = results.slice(0, limit).map((r) => ({
    title: cleanTitle(r.title ?? ""),
    journal: r.journalTitle ?? null,
    year: r.pubYear ?? null,
    authors: r.authorString ?? null,
    pmid: r.pmid ?? null,
    doi: r.doi ?? null,
    url: paperUrl(r),
  }));

  return {
    found: papers.length > 0,
    count: resp.hitCount ?? papers.length,
    query,
    papers,
  };
}
