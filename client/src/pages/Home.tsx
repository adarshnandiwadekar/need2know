import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MutableRefObject } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GitCompareArrows,
  Gauge,
  Info,
  Layers3,
  LibraryBig,
  ListFilter,
  Menu,
  Mail,
  Moon,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  X,
  Sun,
} from "lucide-react";

type Category = "Deadline" | "Requirement" | "Eligibility" | "Cost" | "Change";
type Context = "Student" | "Job Seeker" | "Policy / Compliance" | "General Reader";
  type View = "analyze" | "evaluation" | "method";
type HistoryItem = { id: string; name: string; text: string; context: Context; savedAt: string };
type FeedbackValue = "useful" | "irrelevant";
type DocumentType = "Notice" | "Job posting" | "Policy circular" | "General brief";

type Sentence = {
  id: number;
  text: string;
  start: number;
  end: number;
};

type Occurrence = {
  sentenceId: number;
  text: string;
  start: number;
  end: number;
};

type Finding = {
  id: string;
  category: Category;
  sentence: string;
  explanation: string;
  score: number;
  confidence: number;
  matchLabel: string;
  specificity: number;
  positionWeight: number;
  signals: string[];
  occurrences: Occurrence[];
  filteredReason?: string;
  reviewReason?: string;
  evidence: { terms: string[]; rules: string[] };
};

type EvaluationResult = {
  documents: number;
  overall: { precision: number; recall: number; f1: number };
  categories: Array<{
    category: Category;
    tp: number;
    fp: number;
    fn: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
  examples: Array<{ kind: "TP" | "FP" | "FN"; category: Category; text: string }>;
};

const CATEGORIES: Category[] = ["Deadline", "Requirement", "Eligibility", "Cost", "Change"];
const CATEGORY_META: Record<Category, { number: string; label: string; color: string; soft: string }> = {
  Deadline: { number: "01", label: "DEADLINES", color: "#C97A2E", soft: "#FFF1E2" },
  Requirement: { number: "02", label: "REQUIREMENTS", color: "#5A91B8", soft: "#EAF5FB" },
  Eligibility: { number: "03", label: "ELIGIBILITY", color: "#3E8E7E", soft: "#E8F5F1" },
  Cost: { number: "04", label: "COSTS", color: "#9AA5AD", soft: "#EEF1F3" },
  Change: { number: "05", label: "CHANGES", color: "#6F8FA5", soft: "#EAF0F4" },
};

const CONTEXT_WEIGHTS: Record<Context, Record<Category, number>> = {
  Student: { Deadline: 1, Eligibility: 0.98, Requirement: 0.92, Cost: 0.78, Change: 0.65 },
  "Job Seeker": { Requirement: 1, Eligibility: 0.97, Deadline: 0.9, Change: 0.72, Cost: 0.56 },
  "Policy / Compliance": { Change: 1, Requirement: 0.98, Eligibility: 0.84, Deadline: 0.8, Cost: 0.62 },
  "General Reader": { Deadline: 0.9, Requirement: 0.9, Eligibility: 0.88, Cost: 0.82, Change: 0.82 },
};

const DEMO_TEXT = `Notice: National Skills Fellowship 2026
The application portal opens on 14 September 2026 and closes at 5:00 PM on 30 September 2026. Applications received after the deadline will not be considered.
Applicants must upload a current CV, a 500-word statement of purpose, and proof of enrollment. The statement should explain how the fellowship supports your chosen course.
Students are eligible if they are enrolled full-time in an accredited undergraduate or postgraduate programme and have at least one semester remaining.
The application fee is ₹750 and must be paid online before the form is submitted.
The revised fellowship amount is ₹60,000 per semester, effective from the 2026 intake. The travel allowance has changed to ₹8,000.
Applications close at 5:00 PM on 30 September 2026. Late submissions will not be accepted.
General information about the institution and its history is available on the website.`;

const TRAINING_ROWS: Array<{ category: Category; text: string }> = [
  { category: "Deadline", text: "Applications close on 30 September 2026." },
  { category: "Deadline", text: "Submit the form by Friday at 5 PM." },
  { category: "Deadline", text: "The last date to apply is 14 September." },
  { category: "Requirement", text: "Applicants must upload a current CV." },
  { category: "Requirement", text: "You are required to provide proof of enrollment." },
  { category: "Requirement", text: "A statement of purpose should be attached." },
  { category: "Eligibility", text: "Students are eligible if they are enrolled full-time." },
  { category: "Eligibility", text: "Candidates must have at least two years of experience." },
  { category: "Eligibility", text: "The criteria apply to residents of the state." },
  { category: "Cost", text: "The application fee is ₹750." },
  { category: "Cost", text: "A service charge of $20 is payable online." },
  { category: "Cost", text: "The total cost is Rs. 4,500 per year." },
  { category: "Change", text: "The revised policy is effective from January." },
  { category: "Change", text: "The allowance has changed to ₹8,000." },
  { category: "Change", text: "An updated form is now required." },
  { category: "Deadline", text: "The meeting will be held in the city." },
  { category: "Requirement", text: "The team must submit the report." },
  { category: "Eligibility", text: "This offer is applicable to full-time students." },
  { category: "Cost", text: "No additional charge applies." },
  { category: "Change", text: "The new terms are published below." },
];

const FIXTURES: Array<{ title: string; text: string; labels: Array<{ category: Category; text: string }> }> = [
  {
    title: "Campus grant notice",
    text: "Grant applications must be submitted by 12 October. Students are eligible if they have completed two semesters. The fee is ₹500.",
    labels: [
      { category: "Deadline", text: "Grant applications must be submitted by 12 October." },
      { category: "Eligibility", text: "Students are eligible if they have completed two semesters." },
      { category: "Cost", text: "The fee is ₹500." },
    ],
  },
  {
    title: "Hiring brief",
    text: "Candidates must provide a portfolio. Applicants are eligible with three years of experience. Interviews start on 4 November.",
    labels: [
      { category: "Requirement", text: "Candidates must provide a portfolio." },
      { category: "Eligibility", text: "Applicants are eligible with three years of experience." },
      { category: "Deadline", text: "Interviews start on 4 November." },
    ],
  },
  {
    title: "Policy circular",
    text: "The revised access policy is effective from 1 January. Departments must complete an annual review. The new audit charge is $40.",
    labels: [
      { category: "Change", text: "The revised access policy is effective from 1 January." },
      { category: "Requirement", text: "Departments must complete an annual review." },
      { category: "Cost", text: "The new audit charge is $40." },
    ],
  },
  {
    title: "Scholarship update",
    text: "The scholarship amount has changed to ₹25,000 per term. Eligible applicants must be enrolled full-time. Submit all documents before 20 August.",
    labels: [
      { category: "Change", text: "The scholarship amount has changed to ₹25,000 per term." },
      { category: "Eligibility", text: "Eligible applicants must be enrolled full-time." },
      { category: "Deadline", text: "Submit all documents before 20 August." },
    ],
  },
  {
    title: "Terms update email",
    text: "Updated terms will apply from 1 March. You must review the revised privacy settings. A service fee of $3 may be charged.",
    labels: [
      { category: "Change", text: "Updated terms will apply from 1 March." },
      { category: "Requirement", text: "You must review the revised privacy settings." },
      { category: "Cost", text: "A service fee of $3 may be charged." },
    ],
  },
  {
    title: "Volunteer orientation",
    text: "Registration closes by 6 PM Friday. Volunteers should bring photo ID. The role is open to residents aged at least 18.",
    labels: [
      { category: "Deadline", text: "Registration closes by 6 PM Friday." },
      { category: "Requirement", text: "Volunteers should bring photo ID." },
      { category: "Eligibility", text: "The role is open to residents aged at least 18." },
    ],
  },
];

const HISTORY_KEY = "need2know-history-v1";
const FEEDBACK_KEY = "need2know-feedback-v1";

function tokenize(value: string) {
  return value.toLowerCase().match(/[a-z0-9₹$]+/g) ?? [];
}

function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const matcher = /[^.!?\n]+(?:[.!?]+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const leading = raw.indexOf(trimmed);
    const start = (match.index ?? 0) + leading;
    sentences.push({ id: sentences.length, text: trimmed, start, end: start + trimmed.length });
  }
  return sentences;
}

function trainNaiveBayes() {
  const vocabulary = new Set<string>();
  const categoryCounts: Record<Category, number> = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;
  const tokenCounts: Record<Category, Record<string, number>> = Object.fromEntries(CATEGORIES.map((category) => [category, {}])) as Record<Category, Record<string, number>>;
  const totalTokens: Record<Category, number> = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;

  TRAINING_ROWS.forEach(({ category, text }) => {
    categoryCounts[category] += 1;
    tokenize(text).forEach((token) => {
      vocabulary.add(token);
      tokenCounts[category][token] = (tokenCounts[category][token] ?? 0) + 1;
      totalTokens[category] += 1;
    });
  });

  const classifyText = (text: string) => {
    const tokens = tokenize(text);
    const scores = CATEGORIES.map((category) => {
      let logProbability = Math.log(categoryCounts[category] / TRAINING_ROWS.length);
      tokens.forEach((token) => {
        logProbability += Math.log(((tokenCounts[category][token] ?? 0) + 1) / (totalTokens[category] + vocabulary.size));
      });
      return { category, logProbability };
    });
    const max = Math.max(...scores.map((item) => item.logProbability));
    const normalized = scores.map((item) => ({ category: item.category, probability: Math.exp(item.logProbability - max) }));
    const total = normalized.reduce((sum, item) => sum + item.probability, 0);
    const ranked = normalized.map((item) => ({ ...item, probability: item.probability / total })).sort((a, b) => b.probability - a.probability);
    return { category: ranked[0].category, confidence: Math.max(0.42, ranked[0].probability) };
  };

  const explain = (text: string, category: Category) => {
    const tokens = Array.from(new Set(tokenize(text)));
    const terms = tokens.map((token) => ({ token, weight: (tokenCounts[category][token] ?? 0) / Math.max(1, totalTokens[category]) })).sort((a, b) => b.weight - a.weight).slice(0, 4).map(({ token }) => token);
    return { terms, rules: categorySignals(text).find((item) => item.category === category)?.signals ?? [] };
  };
  return { classify: classifyText, explain };
}

const naiveBayes = trainNaiveBayes();
const classify = naiveBayes.classify;

function categorySignals(text: string): Array<{ category: Category; signals: string[] }> {
  const lower = text.toLowerCase();
  const result: Array<{ category: Category; signals: string[] }> = [];
  const add = (category: Category, signals: string[]) => result.push({ category, signals });

  const deadlineSignals = [
    ...(lower.match(/\b(by|before|due|deadline|last date|on or before|closes|close at)\b/gi) ?? []),
    ...(text.match(/\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|\d{1,2}:\d{2}\s*(?:am|pm)?)\b/gi) ?? []),
  ];
  if (deadlineSignals.length) add("Deadline", Array.from(new Set(deadlineSignals.map((signal) => signal.toLowerCase()))));

  const requirementSignals = lower.match(/\b(must|required to|shall|mandatory|need to|should|submit|upload|provide|attach|review)\b/gi) ?? [];
  if (requirementSignals.length) add("Requirement", Array.from(new Set(requirementSignals.map((signal) => signal.toLowerCase()))));

  const eligibilitySignals = lower.match(/\b(eligible if|eligible|must have|minimum|at least|criteria|applicable to|open to|enrolled|residents aged)\b/gi) ?? [];
  if (eligibilitySignals.length) add("Eligibility", Array.from(new Set(eligibilitySignals.map((signal) => signal.toLowerCase()))));

  const costSignals = [
    ...(text.match(/(?:₹|\$|€|£|rs\.?\s*)\s?\d[\d,]*(?:\.\d{1,2})?/gi) ?? []),
    ...(lower.match(/\b(fee|fees|charge|cost|amount|price|payable|paid)\b/gi) ?? []),
  ];
  if (costSignals.length) add("Cost", Array.from(new Set(costSignals.map((signal) => signal.toLowerCase()))));

  const changeSignals = lower.match(/\b(new|revised|updated|effective from|w\.e\.f\.|amended|changed to|change|updated terms|now required)\b/gi) ?? [];
  if (changeSignals.length) add("Change", Array.from(new Set(changeSignals.map((signal) => signal.toLowerCase()))));

  return result;
}

function cosineSimilarity(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  const vocabulary = Array.from(new Set([...aTokens, ...bTokens]));
  const aVector = vocabulary.map((token) => aTokens.filter((item) => item === token).length);
  const bVector = vocabulary.map((token) => bTokens.filter((item) => item === token).length);
  const dot = aVector.reduce((sum, value, index) => sum + value * bVector[index], 0);
  const magnitudeA = Math.sqrt(aVector.reduce((sum, value) => sum + value * value, 0));
  const magnitudeB = Math.sqrt(bVector.reduce((sum, value) => sum + value * value, 0));
  return magnitudeA && magnitudeB ? dot / (magnitudeA * magnitudeB) : 0;
}

function hasConcreteDetail(text: string) {
  const numbers = (text.match(/\d+/g) ?? []).length;
  const namedWords = (text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []).length;
  return Math.min(1, 0.35 + numbers * 0.16 + namedWords * 0.08 + (text.length > 80 ? 0.12 : 0));
}

function buildExplanation(category: Category, text: string) {
  const date = text.match(/\b(?:\d{1,2}\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/);
  const amount = text.match(/(?:₹|\$|€|£|Rs\.?)\s?\d[\d,]*(?:\.\d{1,2})?/i);
  if (category === "Deadline") return date ? `Deadline signal — action is time-bound around ${date[0]}.` : "Deadline signal — a time limit or closing condition is stated.";
  if (category === "Requirement") return "Action required — the sentence names a document, step, or obligation to complete.";
  if (category === "Eligibility") return "Eligibility signal — a condition limits who can apply or use this offer.";
  if (category === "Cost") return amount ? `Cost signal — ${amount[0]} is mentioned near a fee or payment condition.` : "Cost signal — a fee, charge, or payment condition is mentioned.";
  return "Change signal — the sentence marks a new, revised, or effective condition.";
}

function analyzeDocument(text: string, context: Context, threshold: number) {
  const sentences = splitSentences(text);
  const rawCandidates: Finding[] = [];

  sentences.forEach((sentence) => {
    const matches = categorySignals(sentence.text);
    if (!matches.length) return;
    const model = classify(sentence.text);
    matches.forEach(({ category, signals }) => {
      const specificity = hasConcreteDetail(sentence.text);
      const positionWeight = sentence.id === 0 ? 1 : sentence.id < 2 ? 0.96 : 0.82;
      const contextMatch = CONTEXT_WEIGHTS[context][category];
      const categoryImportance = category === "Deadline" || category === "Requirement" ? 0.95 : 0.86;
      const classifierConfidence = model.category === category ? model.confidence : Math.max(0.38, model.confidence * 0.72);
      const score = 0.3 * contextMatch + 0.25 * categoryImportance + 0.2 * specificity + 0.15 * positionWeight + 0.1 * classifierConfidence;
      rawCandidates.push({
        id: `${category}-${sentence.id}`,
        category,
        sentence: sentence.text,
        explanation: buildExplanation(category, sentence.text),
        score,
        confidence: classifierConfidence,
        matchLabel: model.category === category ? "model-classified" : "rule-matched",
        specificity,
        positionWeight,
        signals,
        evidence: naiveBayes.explain(sentence.text, category),
        occurrences: [{ sentenceId: sentence.id, text: sentence.text, start: sentence.start, end: sentence.end }],
      });
    });
  });

  const deduped: Finding[] = [];
  rawCandidates.forEach((candidate) => {
    const existing = deduped.find((item) => item.category === candidate.category && cosineSimilarity(item.sentence, candidate.sentence) >= 0.72);
    if (existing) {
      existing.occurrences.push(...candidate.occurrences);
      existing.score = Math.max(existing.score, candidate.score);
      existing.signals = Array.from(new Set([...existing.signals, ...candidate.signals]));
      existing.evidence.terms = Array.from(new Set([...existing.evidence.terms, ...candidate.evidence.terms])).slice(0, 4);
      existing.evidence.rules = Array.from(new Set([...existing.evidence.rules, ...candidate.evidence.rules]));
      return;
    }
    deduped.push(candidate);
  });

  const ranked = deduped.sort((a, b) => b.score - a.score).map((finding) => ({ ...finding, score: Math.round(finding.score * 100) / 100 }));
  const withReasons = ranked.map((finding) => ({
    ...finding,
    filteredReason: finding.score < threshold ? `Below threshold (${finding.score.toFixed(2)} < ${threshold.toFixed(2)})` : undefined,
    reviewReason: finding.score < threshold && finding.score >= Math.max(0, threshold - 0.12) ? "Borderline score — verify before ignoring" : undefined,
  }));
  return { sentences, rawCandidateCount: rawCandidates.length, findings: withReasons };
}

function evaluateFixtures(): EvaluationResult {
  const rows = CATEGORIES.map((category) => ({ category, tp: 0, fp: 0, fn: 0 }));
  const examples: EvaluationResult["examples"] = [];
  FIXTURES.forEach((fixture) => {
    const output = analyzeDocument(fixture.text, "General Reader", 0.35).findings;
    const predicted = output.map((finding) => ({ category: finding.category, text: finding.sentence }));
    const matchedTruth = new Set<number>();
    predicted.forEach((prediction) => {
      const truthIndex = fixture.labels.findIndex((label, index) => !matchedTruth.has(index) && label.category === prediction.category && (label.text === prediction.text || cosineSimilarity(label.text, prediction.text) > 0.7));
      if (truthIndex >= 0) {
        matchedTruth.add(truthIndex);
        rows.find((row) => row.category === prediction.category)!.tp += 1;
        if (examples.length < 6) examples.push({ kind: "TP", category: prediction.category, text: prediction.text });
      } else {
        rows.find((row) => row.category === prediction.category)!.fp += 1;
        if (examples.length < 6) examples.push({ kind: "FP", category: prediction.category, text: prediction.text });
      }
    });
    fixture.labels.forEach((label, index) => {
      if (!matchedTruth.has(index)) {
        rows.find((row) => row.category === label.category)!.fn += 1;
        if (examples.length < 6) examples.push({ kind: "FN", category: label.category, text: label.text });
      }
    });
  });
  const totals = rows.reduce((sum, row) => ({ tp: sum.tp + row.tp, fp: sum.fp + row.fp, fn: sum.fn + row.fn }), { tp: 0, fp: 0, fn: 0 });
  const metric = (tp: number, fp: number, fn: number) => {
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
  };
  return {
    documents: FIXTURES.length,
    overall: metric(totals.tp, totals.fp, totals.fn),
    categories: rows.map((row) => ({ ...row, ...metric(row.tp, row.fp, row.fn) })),
    examples,
  };
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function inferDocumentType(text: string): { type: DocumentType; confidence: number; context: Context } {
  const lower = text.toLowerCase();
  const signals: Array<{ type: DocumentType; context: Context; words: string[] }> = [
    { type: "Job posting", context: "Job Seeker", words: ["candidate", "interview", "portfolio", "experience", "role"] },
    { type: "Policy circular", context: "Policy / Compliance", words: ["policy", "revised", "effective from", "compliance", "audit", "department"] },
    { type: "Notice", context: "Student", words: ["application", "applicants", "fellowship", "scholarship", "registration", "notice"] },
  ];
  const ranked = signals.map((signal) => ({ ...signal, count: signal.words.filter((word) => lower.includes(word)).length })).sort((a, b) => b.count - a.count);
  const winner = ranked[0];
  return winner.count ? { type: winner.type, context: winner.context, confidence: Math.min(0.96, 0.55 + winner.count * 0.1) } : { type: "General brief", context: "General Reader", confidence: 0.46 };
}

function compareVersions(leftText: string, rightText: string) {
  const left = splitSentences(leftText);
  const right = splitSentences(rightText);
  const rightSet = new Set(right.map((sentence) => sentence.text.toLowerCase()));
  const leftSet = new Set(left.map((sentence) => sentence.text.toLowerCase()));
  return {
    added: right.filter((sentence) => !leftSet.has(sentence.text.toLowerCase())),
    removed: left.filter((sentence) => !rightSet.has(sentence.text.toLowerCase())),
    unchanged: right.filter((sentence) => leftSet.has(sentence.text.toLowerCase())),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function printDigest(documentName: string, documentType: DocumentType, findings: Finding[], brief: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=860,height=900");
  if (!popup) return false;
  const rows = findings.slice(0, 12).map((finding) => `<li><strong>${escapeHtml(finding.category)}</strong> — ${escapeHtml(finding.sentence)}<small>${escapeHtml(finding.explanation)}</small></li>`).join("");
  popup.document.write(`<!doctype html><html><head><title>Need2Know Digest — ${escapeHtml(documentName)}</title><style>body{font:13px Georgia,serif;color:#1a1613;max-width:760px;margin:0 auto;padding:42px}h1{font:32px Arial,sans-serif;text-transform:uppercase;margin:0 0 6px}h2{font:18px Georgia,serif;border-bottom:1px solid #d8d0c5;padding-bottom:8px;margin-top:28px}.meta{font:11px monospace;color:#776d62;margin-bottom:26px}ol{padding-left:22px}li{margin:0 0 12px;line-height:1.45}li strong{color:#c41e2a;text-transform:uppercase;font:11px monospace}small{display:block;color:#6d645b;font:11px Arial,sans-serif;margin-top:3px}.brief{white-space:pre-wrap;background:#1a1613;color:#f1d0c3;padding:16px;font:11px monospace;line-height:1.5}@media print{body{padding:0}}</style></head><body><h1>Need2Know</h1><div class="meta">ONE-PAGE ACTION DIGEST · ${escapeHtml(documentType)} · ${escapeHtml(documentName)}</div><h2>Priority brief</h2><div class="brief">${escapeHtml(brief)}</div><h2>Traceable findings</h2><ol>${rows}</ol><div class="meta">Generated locally. Verify every item against the original source before acting.</div><script>window.onload=()=>window.print();</script></body></html>`);
  popup.document.close();
  return true;
}

function downloadDigestText(documentName: string, documentType: DocumentType, findings: Finding[], brief: string) {
  const lines = [`NEED2KNOW ONE-PAGE ACTION DIGEST`, `Document type: ${documentType}`, `Document: ${documentName}`, "", brief, "", "TRACEABLE FINDINGS", ...findings.slice(0, 12).map((finding) => `[${finding.category}] ${finding.sentence}\n${finding.explanation}`), "", "Verify every item against the original source before acting."];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${documentName.replace(/\.[^.]+$/, "") || "need2know"}-digest.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadFindings(findings: Finding[], documentName: string) {
  const payload = findings.map(({ id, category, sentence, explanation, score, confidence, signals, occurrences }) => ({ id, category, sentence, explanation, relevance: score, confidence, signals, occurrences: occurrences.map(({ sentenceId }) => sentenceId + 1) }));
  const blob = new Blob([JSON.stringify({ document: documentName, exportedAt: new Date().toISOString(), findings: payload }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${documentName.replace(/\.[^.]+$/, "") || "need2know-findings"}-findings.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createAiBrief(findings: Finding[], documentName: string) {
  const deadlines = findings.filter((finding) => finding.category === "Deadline").slice(0, 2);
  const requirements = findings.filter((finding) => finding.category === "Requirement").slice(0, 2);
  const costs = findings.filter((finding) => finding.category === "Cost").slice(0, 2);
  const lines = [`Action brief for ${documentName}`, "", "Priority actions:"];
  deadlines.forEach((finding) => lines.push(`• Confirm: ${finding.sentence}`));
  requirements.forEach((finding) => lines.push(`• Prepare: ${finding.sentence}`));
  if (!deadlines.length && !requirements.length) lines.push("• Review the surfaced findings below and verify them against the source.");
  if (costs.length) {
    lines.push("", "Money to check:");
    costs.forEach((finding) => lines.push(`• ${finding.sentence}`));
  }
  return lines.join("\n");
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function deadlineDate(sentence: string) {
  const match = sentence.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})?\b/i);
  if (!match) return null;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[2].slice(0, 3).toLowerCase());
  const year = Number(match[3] ?? new Date().getFullYear());
  const day = Number(match[1]);
  return month >= 0 ? `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}` : null;
}

function downloadCalendar(findings: Finding[], documentName: string) {
  const deadlines = findings.filter((finding) => finding.category === "Deadline");
  const today = new Date();
  const fallbackDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = deadlines.map((finding) => {
    const date = deadlineDate(finding.sentence) ?? fallbackDate;
    const needsVerification = deadlineDate(finding.sentence) ? "" : " [VERIFY DATE]";
    return ["BEGIN:VEVENT", `UID:${finding.id}@need2know`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:${icsEscape(`Need2Know: ${finding.sentence.slice(0, 100)}${needsVerification}`)}`, `DESCRIPTION:${icsEscape(`Extracted from ${documentName}. Verify the original source before relying on this reminder.`)}`, "END:VEVENT"].join("\r\n");
  });
  const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Need2Know//Actionability Intelligence//EN", ...events, "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${documentName.replace(/\.[^.]+$/, "") || "need2know"}-deadlines.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openEmailDraft(findings: Finding[], documentName: string) {
  const lines = findings.slice(0, 12).map((finding) => `• ${finding.category}: ${finding.sentence}`);
  const subject = `Need2Know action digest — ${documentName}`;
  const body = [`Key items extracted from ${documentName}:`, "", ...lines, "", "Please verify each item against the original source before acting.", "", "Generated locally by Need2Know."].join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function extractUploadedText(file: File) {
  const lowerName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    return pages.join("\n\n").trim();
  }

  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lowerName.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  const decoded = new TextDecoder().decode(arrayBuffer);
  const controlCharacters = (decoded.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  if (controlCharacters > Math.max(4, decoded.length * 0.01)) {
    throw new Error("This file is binary and does not expose readable text in the browser.");
  }
  return decoded.trim();
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: typeof Search; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={classNames("nav-item", active && "nav-item-active")} onClick={onClick}>
      <Icon size={16} strokeWidth={1.8} />
      <span>{label}</span>
      {active && <ArrowUpRight size={14} className="nav-arrow" />}
    </button>
  );
}

function WorkspaceLink({ icon: Icon, label, onClick }: { icon: typeof Search; label: string; onClick: () => void }) {
  return <button className="workspace-link" onClick={onClick}><Icon size={14} strokeWidth={1.8} /><span>{label}</span><ArrowUpRight size={12} className="workspace-link-arrow" /></button>;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>("analyze");
  const [context, setContext] = useState<Context>("Student");
  const [threshold, setThreshold] = useState(0.35);
  const [documentText, setDocumentText] = useState(DEMO_TEXT);
  const [documentName, setDocumentName] = useState("national-skills-fellowship.txt");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [findingQuery, setFindingQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("Copy brief");
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [reminderStatus, setReminderStatus] = useState("Enable reminders");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [analysisTick, setAnalysisTick] = useState(0);
  const sourceRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const analysis = useMemo(() => analyzeDocument(documentText, context, threshold), [documentText, context, threshold, analysisTick]);
  const documentType = useMemo(() => inferDocumentType(documentText), [documentText]);
  const comparison = useMemo(() => compareVersions(compareLeft, compareRight), [compareLeft, compareRight]);
  const evaluation = useMemo(() => evaluateFixtures(), []);
  const keptFindings = analysis.findings.filter((finding) => !finding.filteredReason);
  const filteredFindings = analysis.findings.filter((finding) => finding.filteredReason);
  const reviewFindings = filteredFindings.filter((finding) => finding.reviewReason);
  const visibleFindings = keptFindings.filter((finding) => (categoryFilter === "All" || finding.category === categoryFilter) && (!findingQuery.trim() || `${finding.category} ${finding.sentence} ${finding.explanation}`.toLowerCase().includes(findingQuery.trim().toLowerCase())));
  const aiBrief = useMemo(() => createAiBrief(keptFindings, documentName), [keptFindings, documentName]);
  const actionFindings = keptFindings.filter((finding) => finding.category === "Deadline" || finding.category === "Requirement").slice(0, 5);
  const selectedFinding = analysis.findings.find((finding) => finding.id === selectedFindingId) ?? keptFindings[0];
  const keptSentenceCount = new Set(keptFindings.flatMap((finding) => finding.occurrences.map((occurrence) => occurrence.sentenceId))).size;
  const filteredSentenceCount = Math.max(0, analysis.sentences.length - keptSentenceCount);
  const reduction = analysis.sentences.length ? filteredSentenceCount / analysis.sentences.length : 0;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored) as HistoryItem[]);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEEDBACK_KEY);
      if (stored) setFeedback(JSON.parse(stored) as Record<string, FeedbackValue>);
    } catch { setFeedback({}); }
  }, []);

  useEffect(() => {
    setContext(documentType.context);
  }, [documentType.type]);

  const saveToHistory = (text: string, name: string) => {
    if (!text.trim()) return;
    const item: HistoryItem = { id: `${Date.now()}-${name}`, name, text, context, savedAt: new Date().toISOString() };
    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.name !== name)].slice(0, 8);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* private browsing may disable storage */ }
      return next;
    });
  };

  useEffect(() => {
    if (!selectedFinding) return;
    const sourceId = selectedFinding.occurrences[0]?.sentenceId;
    if (sourceId === undefined) return;
    const node = sourceRefs.current[sourceId];
    if (node && sourceOpen) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedFinding, sourceOpen]);

  const runAnalysis = () => {
    saveToHistory(documentText, documentName);
    setAnalysisTick((value) => value + 1);
    setSelectedFindingId(null);
    setSourceOpen(false);
  };

  const openSource = (finding: Finding, sentenceId?: number) => {
    setSelectedFindingId(finding.id);
    setSourceOpen(true);
    if (sentenceId !== undefined) {
      window.setTimeout(() => sourceRefs.current[sentenceId]?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const extractedText = await extractUploadedText(file);
      if (!extractedText) throw new Error("No readable text was found in this file.");
      setDocumentText(extractedText);
      setDocumentName(file.name);
      saveToHistory(extractedText, file.name);
      setView("analyze");
      setSourceOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not extract readable text from this file.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const loadFixture = (fixture: (typeof FIXTURES)[number]) => {
    setDocumentText(fixture.text);
    setDocumentName(`${fixture.title.toLowerCase().replace(/\s+/g, "-")}.txt`);
    setView("analyze");
    setSourceOpen(false);
    saveToHistory(fixture.text, `${fixture.title.toLowerCase().replace(/\s+/g, "-")}.txt`);
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setDocumentText(item.text);
    setDocumentName(item.name);
    setContext(item.context);
    setView("analyze");
    setHistoryOpen(false);
    setSourceOpen(false);
  };

  const openComparison = () => {
    const previous = history.find((item) => item.name === documentName && item.text !== documentText) ?? history.find((item) => item.text !== documentText);
    setCompareLeft(previous?.text ?? documentText);
    setCompareRight(documentText);
    setCompareOpen(true);
    window.setTimeout(() => document.getElementById("comparison-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const jumpToWorkspace = (target: string, fallback = "findings-column") => {
    setView("analyze");
    window.setTimeout(() => {
      const node = document.getElementById(target) ?? document.getElementById(fallback);
      node?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(aiBrief); setCopyStatus("Copied"); window.setTimeout(() => setCopyStatus("Copy brief"), 1400); } catch { setCopyStatus("Select and copy manually"); }
  };

  const markFeedback = (finding: Finding, value: FeedbackValue) => {
    setFeedback((current) => {
      const next = { ...current, [finding.id]: value };
      try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next)); } catch { /* storage is optional */ }
      return next;
    });
  };

  const enableReminders = async () => {
    if (!("Notification" in window)) { setReminderStatus("Notifications unavailable"); return; }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") { setReminderStatus("Permission not granted"); return; }
    const deadlines = keptFindings.filter((finding) => finding.category === "Deadline");
    deadlines.forEach((finding) => new Notification("Need2Know deadline", { body: `${finding.sentence} Verify the source before acting.` }));
    setReminderStatus(`${deadlines.length} reminder${deadlines.length === 1 ? "" : "s"} sent`);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">N2K</div>
          <div>
            <div className="brand-name">Need<span>2</span>Know</div>
            <div className="brand-subtitle">Actionability intelligence</div>
          </div>
        </div>
        <div className="rail-rule" />
        <div className="nav-label">Workspace</div>
        <nav className="nav-stack">
          <NavItem icon={ScanSearch} label="Analyze" active={view === "analyze"} onClick={() => setView("analyze")} />
          <div className="workspace-subnav" aria-label="Analysis shortcuts">
            <WorkspaceLink icon={ClipboardList} label="Action brief" onClick={() => jumpToWorkspace("action-brief")} />
            <WorkspaceLink icon={AlertTriangle} label="Review queue" onClick={() => jumpToWorkspace("review-queue")} />
            <WorkspaceLink icon={GitCompareArrows} label="Compare versions" onClick={openComparison} />
          </div>
          <NavItem icon={BarChart3} label="Evaluation" active={view === "evaluation"} onClick={() => setView("evaluation")} />
          <NavItem icon={BookOpenCheck} label="How it works" active={view === "method"} onClick={() => setView("method")} />
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status">
            <div className="status-dot" />
            <div>
              <div className="status-title">Local model active</div>
              <div className="status-caption">No API key required</div>
            </div>
          </div>
          <div className="sidebar-note">
            <span className="eyebrow">DEMO BUILD</span>
            <p>Threshold-based and tuned on a small illustrative set. Inspect every signal before acting.</p>
          </div>
        </div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><span className="breadcrumb-slash">/</span><strong>{view === "analyze" ? "DOCUMENT ANALYSIS" : view === "evaluation" ? "EVALUATION DASHBOARD" : "METHOD NOTE"}</strong></div>
          <div className="topbar-actions">
            <div className="live-pill"><span className="live-pulse" /> LIVE LOCAL PIPELINE</div>
            <div className="topbar-popover-wrap"><button className="icon-button" aria-label="Document history" aria-expanded={historyOpen} onClick={() => { setHistoryOpen((value) => !value); setHelpOpen(false); setProfileOpen(false); }}><Clock3 size={17} /></button>{historyOpen && <div className="topbar-popover history-popover" role="dialog" aria-label="Document history"><div className="popover-heading"><strong>Recent documents</strong><button className="text-button" onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }}>Clear all</button></div>{history.length ? history.map((item) => <button className="history-item" key={item.id} onClick={() => loadHistoryItem(item)}><FileText size={13} /><span><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleString()}</small></span><ArrowUpRight size={12} /></button>) : <p>No saved documents yet. Analyze a document to create a private local history.</p>}</div>}</div>
            <div className="topbar-popover-wrap"><button className="icon-button" aria-label="Help" aria-expanded={helpOpen} onClick={() => { setHelpOpen((value) => !value); setProfileOpen(false); setHistoryOpen(false); }}><CircleHelp size={18} /></button>{helpOpen && <div className="topbar-popover" role="dialog" aria-label="Need2Know help"><strong>Need2Know help</strong><p>Paste a document or drop a PDF, DOCX, or text file. Choose a reader context, tune the threshold, then open any finding to trace it back to the source.</p><button className="text-button" onClick={() => { setHelpOpen(false); setView("method"); }}>Read the method note <ArrowUpRight size={13} /></button></div>}</div>
            <button className="icon-button" aria-label="Compare document versions" onClick={openComparison}><GitCompareArrows size={17} /></button>
            <button className="icon-button" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={() => toggleTheme?.()}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
            <div className="topbar-popover-wrap"><button className="avatar-button" aria-label="Workspace profile" aria-expanded={profileOpen} onClick={() => { setProfileOpen((value) => !value); setHelpOpen(false); }}>AR</button>{profileOpen && <div className="topbar-popover profile-popover" role="dialog" aria-label="Workspace profile"><strong>Analyst workspace</strong><p>This browser workspace keeps documents and exports local to your session. No external account or API key is required for the core pipeline.</p><span className="profile-status"><span className="mini-dot" /> Local pipeline ready</span></div>}</div>
          </div>
        </header>

        {view === "analyze" && (
          <div className="content-wrap">
            <section className="hero-row">
              <div>
                <div className="eyebrow red-eyebrow">DOCUMENT INTELLIGENCE / 01</div>
                <h1>Find what matters.<br /><em>Leave the noise.</em></h1>
                <p className="hero-copy">Need2Know turns long notices, policies, and briefs into a ranked set of actions, conditions, costs, deadlines, and changes — with a path back to the source.</p>
              </div>
              <div className="hero-stamp">
                <div className="stamp-label">ANALYSIS STATE</div>
                <div className="stamp-value"><span className="stamp-dot" /> READY</div>
                <div className="stamp-meta">Local extraction · model scoring · live threshold</div>
              </div>
            </section>

            <section className="ingest-card">
              <div className="ingest-head">
                <div className="section-kicker"><span>01</span> INGEST DOCUMENT</div>
                <div className="file-badge"><FileText size={14} /> {documentName}</div>
              </div>
              <div className="ingest-grid">
                <div className={classNames("dropzone", dragActive && "dropzone-active")} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false); }} onDrop={handleDrop}>
                  <input id="file-upload" type="file" accept="*/*" onChange={(event) => handleFile(event.target.files?.[0])} />
                  <label htmlFor="file-upload" className="dropzone-label">
                    <div className="upload-icon"><Upload size={19} /></div>
                    <div><strong>{uploading ? "Extracting readable text…" : "Drop any file here"}</strong><span>PDF, DOCX, TXT, or any text-like file · no app upload cap</span></div>
                  </label>
                </div>
                <div className="paste-wrap">
                  <textarea value={documentText} onChange={(event) => setDocumentText(event.target.value)} aria-label="Document text" />
                  <div className="paste-footer"><span>{formatNumber(documentText.length)} characters · {analysis.sentences.length} sentences detected</span><button className="text-button" onClick={() => setDocumentText("")}>Clear <X size={13} /></button></div>
                </div>
              </div>
              {uploadError && <div className="inline-error"><AlertTriangle size={15} /> {uploadError}</div>}
              <div className="ingest-actions">
                <div className="demo-selector"><span>TRY A FIXTURE</span>{FIXTURES.slice(0, 3).map((fixture) => <button key={fixture.title} onClick={() => loadFixture(fixture)}>{fixture.title}</button>)}</div>
                <button className="primary-button" onClick={runAnalysis}><Sparkles size={16} /> Analyze document <ArrowUpRight size={15} /></button>
              </div>
            </section>

            {compareOpen && <ComparisonPanel leftText={compareLeft} rightText={compareRight} onLeftChange={setCompareLeft} onRightChange={setCompareRight} comparison={comparison} onClose={() => setCompareOpen(false)} />}

            <section className="control-row">
              <div className="context-control">
                <div className="control-label"><Target size={15} /> RELEVANCE CONTEXT</div>
                <div className="context-options">{(Object.keys(CONTEXT_WEIGHTS) as Context[]).map((item) => <button key={item} className={classNames("context-chip", context === item && "context-chip-active")} onClick={() => setContext(item)}>{item}</button>)}</div>
              </div>
              <div className="threshold-control">
                <div className="threshold-head"><div className="control-label"><SlidersHorizontal size={15} /> FILTER THRESHOLD</div><strong>{threshold.toFixed(2)}</strong></div>
                <input type="range" min="0.25" max="0.75" step="0.01" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
                <div className="threshold-caption"><span>more signal</span><span>more noise</span></div>
              </div>
            </section>

            <section className="compression-banner">
              <div className="compression-main"><div className="compression-number">{formatNumber(analysis.sentences.length)} <span>sentences</span></div><div className="compression-arrow">→</div><div className="compression-number emphasis">{keptFindings.length} <span>key findings kept</span></div></div>
              <div className="compression-copy"><strong>{formatNumber(filteredSentenceCount)} sentences filtered as non-actionable</strong><span>{percent(reduction)} reduction · computed from this document</span></div>
              <div className="compression-icon"><Filter size={20} /></div>
            </section>

            <section className="ai-brief-card" id="action-brief">
              <div className="card-heading"><div><div className="eyebrow">AI ACTION BRIEF / 02</div><h2>Do this first</h2></div><div className="brief-actions"><button className="text-button" onClick={copyBrief}><Copy size={13} /> {copyStatus}</button><button className="workflow-button" onClick={() => printDigest(documentName, documentType.type, keptFindings, aiBrief)} disabled={!keptFindings.length}><Download size={13} /> Print / PDF</button><button className="workflow-button" onClick={() => downloadDigestText(documentName, documentType.type, keptFindings, aiBrief)} disabled={!keptFindings.length}><FileText size={13} /> TXT digest</button><button className="workflow-button" onClick={() => downloadCalendar(keptFindings, documentName)} disabled={!keptFindings.some((finding) => finding.category === "Deadline")}><CalendarDays size={13} /> Add deadlines</button><button className="workflow-button" onClick={() => openEmailDraft(keptFindings, documentName)} disabled={!keptFindings.length}><Mail size={13} /> Email digest</button></div></div>
              <div className="smart-meta-row"><span><Sparkles size={13} /> Detected document: <strong>{documentType.type}</strong> · {percent(documentType.confidence)} confidence</span><span>Context auto-selected: <strong>{documentType.context}</strong></span></div>
              <div className="ai-brief-grid"><div><p className="ai-brief-intro">A local, explainable action plan generated from the highest-confidence deadlines and requirements. Tick items off as you verify them against the source.</p><div className="action-checklist">{actionFindings.length ? actionFindings.map((finding) => <label className={classNames("action-item", completedActions.includes(finding.id) && "action-item-done")} key={finding.id}><input type="checkbox" checked={completedActions.includes(finding.id)} onChange={() => setCompletedActions((items) => items.includes(finding.id) ? items.filter((item) => item !== finding.id) : [...items, finding.id])} /><span>{finding.sentence}</span></label>) : <span className="ai-empty">No deadline or requirement signals are above the current threshold.</span>}</div></div><pre className="ai-brief-text">{aiBrief}</pre></div>
              <div className="deadline-panel"><div><div className="eyebrow">UPCOMING DEADLINES</div><strong>{keptFindings.filter((finding) => finding.category === "Deadline").length ? `${keptFindings.filter((finding) => finding.category === "Deadline").length} extracted deadline signals` : "No deadline signals found"}</strong><p>Browser reminders are on-demand and stay local to this session.</p></div><button className="workflow-button" onClick={enableReminders} disabled={!keptFindings.some((finding) => finding.category === "Deadline")}><Bell size={13} /> {reminderStatus}</button></div>
            </section>

            <div className={classNames("workspace-grid", sourceOpen && "source-open")}>
              <section className="findings-column" id="findings-column">
                <div className="results-head"><div><div className="eyebrow">RANKED SIGNALS / {context.toUpperCase()}</div><h2>{keptFindings.length ? "What deserves your attention" : "No findings above threshold"}</h2></div><div className="results-meta"><span className="model-badge"><span className="mini-dot" /> model + rules</span><span>{analysis.rawCandidateCount} candidates</span><button className="text-button export-button" onClick={() => downloadFindings(keptFindings, documentName)} disabled={!keptFindings.length}><Download size={13} /> Export JSON</button></div></div>
                <div className="honesty-note"><Info size={14} /><span>Filtering is threshold-based and tuned on a small demo dataset. It can miss unusually phrased important information or filter out something relevant. Adjust the slider if results seem too aggressive or noisy.</span></div>
                {keptFindings.length > 0 && <div className="finding-tools"><label className="finding-search"><Search size={14} /><input value={findingQuery} onChange={(event) => setFindingQuery(event.target.value)} placeholder="Search surfaced findings" aria-label="Search surfaced findings" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "All" | Category)} aria-label="Filter finding category"><option value="All">All categories</option>{CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}</select><span>{visibleFindings.length} shown</span></div>}
                {keptFindings.length === 0 ? <div className="empty-state"><div className="empty-icon"><ListFilter size={24} /></div><h3>Nothing cleared the current bar.</h3><p>Lower the threshold to inspect lower-confidence candidates, or paste a document with more concrete requirements and dates.</p><button className="secondary-button" onClick={() => setThreshold(0.35)}>Reset threshold</button></div> : visibleFindings.length === 0 ? <div className="empty-state"><div className="empty-icon"><Search size={24} /></div><h3>No matching findings.</h3><p>Try another search term or reset the category filter.</p><button className="secondary-button" onClick={() => { setFindingQuery(""); setCategoryFilter("All"); }}>Reset filters</button></div> : <div className="finding-list">{visibleFindings.map((finding, index) => <FindingCard key={finding.id} finding={finding} index={index} feedback={feedback[finding.id]} onFeedback={markFeedback} onSource={openSource} />)}</div>}
                {reviewFindings.length > 0 && <section className="review-queue" id="review-queue"><div className="review-heading"><div><div className="eyebrow">UNCERTAINTY QUEUE</div><h3>Needs review before dismissal</h3></div><span>{reviewFindings.length} borderline</span></div><p>These findings sit just below the active threshold. They are not counted as kept, but they should not disappear silently.</p>{reviewFindings.map((finding) => <div className="review-item" key={finding.id}><span className="filtered-category" style={{ color: CATEGORY_META[finding.category].color }}>{finding.category}</span><span>{finding.sentence}</span><button className="source-button" onClick={() => openSource(finding)}>Inspect <ArrowUpRight size={12} /></button></div>)}</section>}
                {filteredFindings.length > 0 && <div className="filtered-section"><button className="filtered-toggle" onClick={() => setShowFiltered((value) => !value)}><span><Filter size={15} /> Show filtered content <small>{filteredFindings.length}</small></span><ChevronDown size={16} className={classNames(showFiltered && "rotate-180")} /></button>{showFiltered && <div className="filtered-list">{filteredFindings.map((finding) => <div className="filtered-item" key={finding.id}><span className="filtered-category" style={{ color: CATEGORY_META[finding.category].color }}>{finding.category}</span><span>{finding.sentence}</span><em>{finding.filteredReason}</em></div>)}</div>}</div>}
              </section>

              <aside className="insight-column">
                <div className="insight-card context-card"><div className="card-topline"><span className="eyebrow">CONTEXT PROFILE</span><span className="card-index">01</span></div><h3>{context}</h3><p>Ranking weights are tuned to surface the conditions this reader is most likely to act on.</p><div className="weight-list">{CATEGORIES.map((category) => <div key={category} className="weight-row"><span>{category}</span><div className="weight-track"><span style={{ width: `${CONTEXT_WEIGHTS[context][category] * 100}%`, background: CATEGORY_META[category].color }} /></div><b>{Math.round(CONTEXT_WEIGHTS[context][category] * 100)}</b></div>)}</div></div>
                <div className="insight-card trace-card"><div className="card-topline"><span className="eyebrow">PIPELINE TRACE</span><span className="verified-label"><Check size={13} /> REAL COMPUTATION</span></div><div className="trace-step"><span className="trace-num">01</span><div><strong>Candidate detection</strong><p>Rule patterns scan every sentence.</p></div></div><div className="trace-step"><span className="trace-num">02</span><div><strong>Local classifier</strong><p>Naive Bayes model trained on {TRAINING_ROWS.length} labeled examples.</p></div></div><div className="trace-step"><span className="trace-num">03</span><div><strong>Rank + compress</strong><p>Cosine deduplication and the live threshold produce this view.</p></div></div><button className="link-button" onClick={() => setView("method")}>Read the method note <ArrowUpRight size={14} /></button></div>
                {sourceOpen && selectedFinding && <SourcePanel finding={selectedFinding} text={documentText} sentences={analysis.sentences} sourceRefs={sourceRefs} onClose={() => setSourceOpen(false)} />}
              </aside>
            </div>
          </div>
        )}

        {view === "evaluation" && <EvaluationView evaluation={evaluation} onLoadFixture={loadFixture} />}
        {view === "method" && <MethodView onBack={() => setView("analyze")} />}
      </main>
    </div>
  );
}

function ComparisonPanel({ leftText, rightText, onLeftChange, onRightChange, comparison, onClose }: { leftText: string; rightText: string; onLeftChange: (value: string) => void; onRightChange: (value: string) => void; comparison: ReturnType<typeof compareVersions>; onClose: () => void }) {
  return <section className="comparison-panel" id="comparison-panel"><div className="comparison-heading"><div><div className="eyebrow">VERSION COMPARISON / 04</div><h2>See what changed.</h2><p>Paste or load two versions to review sentence-level additions and removals before rerunning the analyzer.</p></div><button className="icon-button small" aria-label="Close comparison" onClick={onClose}><X size={16} /></button></div><div className="comparison-inputs"><label><span>Previous version</span><textarea value={leftText} onChange={(event) => onLeftChange(event.target.value)} /></label><label><span>Current version</span><textarea value={rightText} onChange={(event) => onRightChange(event.target.value)} /></label></div><div className="comparison-summary"><span className="comparison-added">+ {comparison.added.length} added</span><span className="comparison-removed">− {comparison.removed.length} removed</span><span>{comparison.unchanged.length} unchanged</span></div><div className="comparison-diff">{comparison.added.map((sentence) => <div className="diff-row diff-added" key={`added-${sentence.id}`}><strong>ADDED</strong><span>{sentence.text}</span></div>)}{comparison.removed.map((sentence) => <div className="diff-row diff-removed" key={`removed-${sentence.id}`}><strong>REMOVED</strong><span>{sentence.text}</span></div>)}{!comparison.added.length && !comparison.removed.length && <div className="diff-empty">No sentence-level changes detected yet.</div>}</div></section>;
}

function FindingCard({ finding, index, feedback, onFeedback, onSource }: { finding: Finding; index: number; feedback?: FeedbackValue; onFeedback: (finding: Finding, value: FeedbackValue) => void; onSource: (finding: Finding, sentenceId?: number) => void }) {
  const meta = CATEGORY_META[finding.category];
  return <article className="finding-card" style={{ "--category-color": meta.color, "--category-soft": meta.soft } as CSSProperties}>
    <div className="finding-rail"><span>{String(index + 1).padStart(2, "0")}</span><div className="finding-rule" /></div>
    <div className="finding-body"><div className="finding-top"><span className="category-label"><span className="category-dot" /> {finding.category}</span><span className="confidence-label">{finding.matchLabel} · {percent(finding.confidence)} confidence</span></div><p className="finding-sentence">{finding.sentence}</p><p className="finding-explanation">{finding.explanation}</p><details className="evidence-details"><summary><ShieldCheck size={13} /> Why this was classified <ChevronDown size={14} /></summary><div className="evidence-grid"><div><span>Top model terms</span><b>{finding.evidence.terms.join(" · ") || "No dominant terms"}</b></div><div><span>Matched rules</span><b>{finding.evidence.rules.join(" · ") || "No explicit rule"}</b></div></div></details><div className="finding-footer"><button className="source-button" onClick={() => onSource(finding)}><ExternalLink size={14} /> View in source <span>· sentence {finding.occurrences[0].sentenceId + 1}</span></button><div className="finding-score"><span>relevance</span><strong>{finding.score.toFixed(2)}</strong></div></div><div className="feedback-row"><span>Was this useful?</span><button className={classNames(feedback === "useful" && "feedback-active")} onClick={() => onFeedback(finding, "useful")}>Useful</button><button className={classNames(feedback === "irrelevant" && "feedback-active feedback-negative")} onClick={() => onFeedback(finding, "irrelevant")}>Not relevant</button></div>{finding.occurrences.length > 1 && <details className="occurrence-details"><summary><Layers3 size={13} /> Mentioned in {finding.occurrences.length} places <ChevronDown size={14} /></summary><div className="occurrence-list">{finding.occurrences.map((occurrence) => <button key={`${finding.id}-${occurrence.sentenceId}`} onClick={() => onSource(finding, occurrence.sentenceId)}>Sentence {occurrence.sentenceId + 1} <ArrowUpRight size={13} /></button>)}</div></details>}</div>
  </article>;
}

function SourcePanel({ finding, text, sentences, sourceRefs, onClose }: { finding: Finding; text: string; sentences: Sentence[]; sourceRefs: MutableRefObject<Record<number, HTMLDivElement | null>>; onClose: () => void }) {
  return <div className="source-panel"><div className="source-head"><div><div className="eyebrow">SOURCE VIEW</div><h3>Trace the exact sentence</h3></div><button className="icon-button small" onClick={onClose} aria-label="Close source"><X size={16} /></button></div><div className="source-note"><ShieldCheck size={15} /><span>Position metadata is preserved from the pasted document.</span></div><div className="source-document">{sentences.map((sentence) => { const active = finding.occurrences.some((occurrence) => occurrence.sentenceId === sentence.id); return <div key={sentence.id} ref={(node) => { sourceRefs.current[sentence.id] = node; }} className={classNames("source-sentence", active && "source-sentence-active")}><span className="source-line">{String(sentence.id + 1).padStart(2, "0")}</span><span>{sentence.text}</span></div>; })}</div><div className="source-footer"><FileText size={14} /><span>{formatNumber(text.length)} characters · {sentences.length} sentences</span></div></div>;
}

function EvaluationView({ evaluation, onLoadFixture }: { evaluation: EvaluationResult; onLoadFixture: (fixture: (typeof FIXTURES)[number]) => void }) {
  return <div className="content-wrap evaluation-wrap"><section className="hero-row compact"><div><div className="eyebrow red-eyebrow">EVALUATION / 02</div><h1>Measure the signal.<br /><em>Keep the caveat.</em></h1><p className="hero-copy">A transparent view of how the current rule + local model pipeline performs against manually labeled demo documents.</p></div><div className="evaluation-mark"><Gauge size={27} /><span>{evaluation.documents} demo docs</span></div></section><div className="eval-caveat"><AlertTriangle size={17} /><span>Evaluated on {evaluation.documents} demo documents — a small illustrative set, not a statistically representative benchmark. These numbers are inspectable, not a production-grade accuracy claim.</span></div><section className="metric-grid">{[{ label: "Precision", value: evaluation.overall.precision, note: "of surfaced findings" }, { label: "Recall", value: evaluation.overall.recall, note: "of labeled findings" }, { label: "F1 score", value: evaluation.overall.f1, note: "harmonic mean" }].map((metric) => <div className="metric-card" key={metric.label}><span className="eyebrow">{metric.label}</span><strong>{percent(metric.value)}</strong><span>{metric.note}</span></div>)}</section><section className="evaluation-grid"><div className="table-card"><div className="card-heading"><div><div className="eyebrow">CATEGORY BREAKDOWN</div><h2>Where the pipeline lands</h2></div><BarChart3 size={19} /></div><div className="eval-table"><div className="eval-row eval-head"><span>Category</span><span>TP</span><span>FP</span><span>FN</span><span>F1</span></div>{evaluation.categories.map((row) => <div className="eval-row" key={row.category}><span><i className="table-dot" style={{ background: CATEGORY_META[row.category].color }} />{row.category}</span><span>{row.tp}</span><span>{row.fp}</span><span>{row.fn}</span><strong>{percent(row.f1)}</strong></div>)}</div></div><div className="examples-card"><div className="card-heading"><div><div className="eyebrow">INSPECTABLE EXAMPLES</div><h2>Not just a headline</h2></div><Search size={18} /></div><div className="example-list">{evaluation.examples.map((example, index) => <div className="example-row" key={`${example.kind}-${index}`}><span className={classNames("example-kind", `kind-${example.kind.toLowerCase()}`)}>{example.kind}</span><div><span className="example-category">{example.category}</span><p>{example.text}</p></div></div>)}</div></div></section><section className="fixture-section"><div className="card-heading"><div><div className="eyebrow">LABELED FIXTURES</div><h2>Replay the small test set</h2></div><LibraryBig size={19} /></div><div className="fixture-grid">{FIXTURES.map((fixture) => <button className="fixture-card" key={fixture.title} onClick={() => onLoadFixture(fixture)}><span className="fixture-number">{String(FIXTURES.indexOf(fixture) + 1).padStart(2, "0")}</span><span><strong>{fixture.title}</strong><small>{fixture.labels.length} labeled findings · open in analyzer</small></span><ArrowUpRight size={15} /></button>)}</div></section></div>;
}

function MethodView({ onBack }: { onBack: () => void }) {
  return <div className="content-wrap method-wrap"><section className="hero-row compact"><div><div className="eyebrow red-eyebrow">METHOD NOTE / 03</div><h1>Less summary.<br /><em>More consequence.</em></h1><p className="hero-copy">Need2Know is designed to answer “what do I need to do, know, or decide?” — not simply “what did this document say?”</p></div><div className="method-stamp"><ClipboardList size={26} /><span>TRACEABLE BY DESIGN</span></div></section><div className="method-grid"><section className="method-card formula-card"><div className="eyebrow">RANKING FORMULA</div><h2>Every score has a trail.</h2><div className="formula">0.30 <span>context</span> + 0.25 <span>category</span> + 0.20 <span>specificity</span> + 0.15 <span>position</span> + 0.10 <span>model</span></div><p>Context match aligns the category with the reader profile. Category importance gives deadlines and requirements a stronger base. Specificity rewards concrete dates, amounts, and named constraints. Position adds a small structural boost. The final term is the local classifier confidence.</p><button className="secondary-button" onClick={onBack}>Back to the workspace <ArrowUpRight size={14} /></button></section><section className="method-card pipeline-card"><div className="eyebrow">PIPELINE</div><div className="method-step"><span>01</span><div><strong>Detect</strong><p>Rules find deadline, requirement, eligibility, cost, and change signals sentence by sentence.</p></div></div><div className="method-step"><span>02</span><div><strong>Classify</strong><p>A Multinomial Naive Bayes model is trained in-browser on {TRAINING_ROWS.length} labeled examples and returns a probability-like confidence.</p></div></div><div className="method-step"><span>03</span><div><strong>Deduplicate</strong><p>Cosine similarity merges near-identical findings and keeps every source occurrence attached.</p></div></div><div className="method-step"><span>04</span><div><strong>Filter</strong><p>A live threshold removes low-scoring candidates from the main view and keeps the reason inspectable.</p></div></div></section></div><section className="limitations-card"><div className="limitation-icon"><Info size={19} /></div><div><div className="eyebrow">LIMITATIONS, PLAINLY STATED</div><h2>This is a threshold-based local demo.</h2><p>The classifier is trained on a small dataset and will not generalize broadly. Rule patterns have blind spots for unusually phrased documents. Filtering is not perfect and may miss important information or suppress something relevant. The evaluation set is demo-scale, not statistically representative. For consequential decisions, verify every surfaced item against the original source.</p></div></section></div>;
}

export { analyzeDocument, evaluateFixtures, splitSentences };
