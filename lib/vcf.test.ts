import { describe, it, expect } from "vitest";
import { parseVcf, zygosityFromGt, genomicHgvs } from "@/lib/vcf";

const VCF = `##fileformat=VCFv4.2
##reference=GRCh38
##contig=<ID=chr17>
##FILTER=<ID=PASS,Description="All filters passed">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE_PT001
chr17\t43093464\trs80357064\tG\tA\t100\tPASS\t.\tGT:DP:GQ\t0/1:40:99
chr17\t7674220\trs28934578\tC\tT\t100\tPASS\t.\tGT:DP:GQ\t1/1:46:99
`;

describe("parseVcf", () => {
  it("parses all records with coordinates, rsID, zygosity and a VEP query", () => {
    const r = parseVcf(VCF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reference).toBe("GRCh38");
    expect(r.variants).toHaveLength(2);
    const [a, b] = r.variants;
    expect(a).toMatchObject({ chrom: "chr17", pos: 43093464, id: "rs80357064", ref: "G", alt: "A" });
    expect(a.zygosity).toBe("heterozygous");
    expect(a.query).toBe("rs80357064"); // rsID preferred
    expect(b.zygosity).toBe("homozygous");
  });

  it("falls back to genomic HGVS as the query when no rsID is present", () => {
    const noRs = VCF.replace("rs80357064", ".");
    const r = parseVcf(noRs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.variants[0].id).toBeNull();
    expect(r.variants[0].query).toBe("17:g.43093464G>A");
  });

  it("rejects an empty file", () => {
    expect(parseVcf("   ")).toEqual({ ok: false, reason: "That file is empty." });
  });

  it("rejects a non-VCF file", () => {
    const r = parseVcf("hello world\nthis is just text\n");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/doesn't look like a VCF/i);
  });

  it("rejects a header-only VCF with no records", () => {
    const r = parseVcf("##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\n");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/no variant records/i);
  });

  it("reports when every record is filtered out (none PASS)", () => {
    const filtered = VCF.replace(/PASS/g, "LowQual").replace("##FILTER=<ID=LowQual", "##FILTER=<ID=LowQual");
    const r = parseVcf(filtered);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/filtered out/i);
  });
});

describe("zygosityFromGt", () => {
  it("maps genotypes to zygosity", () => {
    expect(zygosityFromGt("0/1")).toBe("heterozygous");
    expect(zygosityFromGt("1|0")).toBe("heterozygous");
    expect(zygosityFromGt("1/1")).toBe("homozygous");
    expect(zygosityFromGt("1")).toBe("hemizygous");
    expect(zygosityFromGt("0/0")).toBe("unknown");
    expect(zygosityFromGt(null)).toBe("unknown");
  });
});

describe("genomicHgvs", () => {
  it("strips chr and builds g. notation", () => {
    expect(genomicHgvs("chr17", 7674220, "C", "T")).toBe("17:g.7674220C>T");
  });
});
