import { describe, expect, it } from "vitest";
import { analyzeDocument, evaluateFixtures, splitSentences } from "./Home";

describe("Need2Know local pipeline", () => {
  it("preserves sentence order and source offsets", () => {
    const text = "First notice. Submit by Friday. Cost is ₹500.";
    const sentences = splitSentences(text);

    expect(sentences).toHaveLength(3);
    expect(text.slice(sentences[1].start, sentences[1].end)).toBe("Submit by Friday.");
    expect(sentences[2].id).toBe(2);
  });

  it("detects real categories, ranks them, and filters by threshold", () => {
    const result = analyzeDocument(
      "Applications close by 30 September. Applicants must upload a CV. The fee is ₹500. The building has a long history.",
      "Student",
      0.35,
    );

    expect(result.sentences).toHaveLength(4);
    expect(result.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining(["Deadline", "Requirement", "Cost"]));
    expect(result.findings.every((finding) => finding.score >= 0.25 && finding.score <= 1)).toBe(true);
    expect(result.findings.some((finding) => finding.filteredReason)).toBe(false);

    const strict = analyzeDocument("Applications close by 30 September. Applicants must upload a CV.", "Student", 0.95);
    expect(strict.findings.some((finding) => finding.filteredReason)).toBe(true);
  });

  it("deduplicates repeated signals while retaining source occurrences", () => {
    const result = analyzeDocument(
      "Submit the application by Friday. Submit the application by Friday. The fee is ₹500.",
      "General Reader",
      0.35,
    );
    const repeated = result.findings.find((finding) => finding.category === "Requirement");

    expect(repeated).toBeDefined();
    expect(repeated?.occurrences.length).toBe(2);
  });

  it("computes inspectable evaluation metrics from the fixture set", () => {
    const evaluation = evaluateFixtures();

    expect(evaluation.documents).toBe(6);
    expect(evaluation.overall.precision).toBeGreaterThanOrEqual(0);
    expect(evaluation.overall.precision).toBeLessThanOrEqual(1);
    expect(evaluation.overall.recall).toBeGreaterThanOrEqual(0);
    expect(evaluation.overall.recall).toBeLessThanOrEqual(1);
    expect(evaluation.categories).toHaveLength(5);
    expect(evaluation.examples.length).toBeGreaterThan(0);
  });
});
