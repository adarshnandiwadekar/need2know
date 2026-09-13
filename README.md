# Need2Know — Actionability Intelligence

Need2Know is an editorial document-intelligence workspace that surfaces what a reader may need to **do, know, or decide**: deadlines, requirements, eligibility conditions, costs, and changes. It is intentionally not a generic summarizer.

## What is implemented

The current website includes a functional browser-local fallback pipeline that works without external API keys:

1. **Sentence extraction with offsets.** Pasted text is segmented into sentences while preserving character offsets. The source view uses the same offsets and sentence IDs to highlight the exact finding source.
2. **Rule-based candidate detection.** Each sentence is scanned for deadline, requirement, eligibility, cost, and change patterns. Currency, dates, obligation language, and update language are detected with deterministic regular expressions.
3. **Local model scoring.** A small Multinomial Naive Bayes classifier is trained in-browser from 20 labeled examples. It returns a probability-like confidence used by the ranking formula. The UI labels whether a finding is `model-classified` or `rule-matched`.
4. **Context personalization.** Student, Job Seeker, Policy / Compliance, and General Reader profiles change category weights and therefore change ranking.
5. **Relevance ranking.** Each finding uses the following live formula:

   ```text
   relevance_score =
     0.30 * context_match +
     0.25 * category_importance +
     0.20 * specificity +
     0.15 * position_weight +
     0.10 * classifier_confidence
   ```

   Specificity rewards concrete dates, numbers, named entities, and longer concrete statements. Position gives a small boost to the first sentences. The selected context changes `context_match`.
6. **Deduplication.** Same-category findings are compared using cosine similarity over token-count vectors. Similar findings collapse into one representative finding while retaining all sentence occurrences.
7. **Threshold filtering.** Findings below the live slider threshold are removed from the main results view. The filtered section remains inspectable and gives the reason. Compression statistics use unique source sentences, so the reduction cannot become negative when one sentence yields multiple category findings.
8. **Template explanations.** Every finding receives a category-specific explanation using the sentence’s detected dates, amounts, or obligation signals.
9. **Evaluation dashboard.** Six manually labeled demo fixtures are replayed through the same pipeline. Precision, recall, F1, category breakdown, and inspectable TP/FP/FN examples are computed at runtime.

## Upload support

The file picker accepts **any file type** with no application-enforced upload-size cap. The browser extracts readable text from `.txt`, PDF, and DOCX files. Other text-like formats are decoded as UTF-8 when possible. Binary formats that do not expose readable text are rejected with a clear message instead of being treated as successfully analyzed. Very large files may still be constrained by the browser, device memory, or hosting platform, and extraction errors are surfaced honestly.

## Honest scope of this delivery

The managed website scaffold used for this delivery is a React + Vite + TypeScript + Tailwind + Express/tRPC application with a managed database capability. It is not a Python/FastAPI + SQLite runtime, so this version deliberately ships the functional browser-local fallback rather than pretending that a FastAPI/SQLite backend exists. PDF and DOCX extraction is implemented client-side with `pdfjs-dist` and `mammoth`; page/paragraph persistence and server-side extraction are not included.

No external LLM API is required. The core extraction, model scoring, ranking, deduplication, filtering, source linking, and evaluation all work with the API key unset. The current website does not claim persistence, PDF/DOCX parsing, or production-scale ML generalization.

## Evaluation caveat

The dashboard is evaluated on **6 demo documents** with manually authored labels. This is a small illustrative set, not a statistically representative benchmark. The classifier is trained on a small demo dataset and will not generalize broadly. Rule-based detection has known blind spots for unusually phrased documents. Filtering is threshold-based, not perfect, and can miss important information or occasionally filter out something relevant. For consequential decisions, verify surfaced findings against the original source.

## Run locally

```bash
pnpm install
pnpm dev
```

Validation commands:

```bash
pnpm test --run
pnpm check
pnpm build
```

The test suite covers sentence offsets, category detection, threshold filtering, deduplication, and evaluation metric computation.
