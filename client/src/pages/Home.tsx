import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Info,
  Layers3,
  LibraryBig,
  ListFilter,
  Menu,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  X,
} from "lucide-react";

type Category = "Deadline" | "Requirement" | "Eligibility" | "Cost" | "Change";
type Context = "Student" | "Job Seeker" | "Policy / Compliance" | "General Reader";
type View = "analyze" | "evaluation" | "method";

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
  Deadline: { number: "01", label: "DEADLINES", color: "#B8863B", soft: "#F2E9D8" },
  Requirement: { number: "02", label: "REQUIREMENTS", color: "#C41E2A", soft: "#F5E0E2" },
  Eligibility: { number: "03", label: "ELIGIBILITY", color: "#5C6B3F", soft: "#E5E9DE" },
  Cost: { number: "04", label: "COSTS", color: "#8C8377", soft: "#E9E4DD" },
  Change: { number: "05", label: "CHANGES", color: "#6457A6", soft: "#E8E5F4" },
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

  return (text: string) => {
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
}

const classify = trainNaiveBayes();

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
      return;
    }
    deduped.push(candidate);
  });

  const ranked = deduped.sort((a, b) => b.score - a.score).map((finding) => ({ ...finding, score: Math.round(finding.score * 100) / 100 }));
  const withReasons = ranked.map((finding) => ({
    ...finding,
    filteredReason: finding.score < threshold ? `Below threshold (${finding.score.toFixed(2)} < ${threshold.toFixed(2)})` : undefined,
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

export default function Home() {
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
  const [analysisTick, setAnalysisTick] = useState(0);
  const sourceRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const analysis = useMemo(() => analyzeDocument(documentText, context, threshold), [documentText, context, threshold, analysisTick]);
  const evaluation = useMemo(() => evaluateFixtures(), []);
  const keptFindings = analysis.findings.filter((finding) => !finding.filteredReason);
  const filteredFindings = analysis.findings.filter((finding) => finding.filteredReason);
  const selectedFinding = analysis.findings.find((finding) => finding.id === selectedFindingId) ?? keptFindings[0];
  const keptSentenceCount = new Set(keptFindings.flatMap((finding) => finding.occurrences.map((occurrence) => occurrence.sentenceId))).size;
  const filteredSentenceCount = Math.max(0, analysis.sentences.length - keptSentenceCount);
  const reduction = analysis.sentences.length ? filteredSentenceCount / analysis.sentences.length : 0;

  useEffect(() => {
    if (!selectedFinding) return;
    const sourceId = selectedFinding.occurrences[0]?.sentenceId;
    if (sourceId === undefined) return;
    const node = sourceRefs.current[sourceId];
    if (node && sourceOpen) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedFinding, sourceOpen]);

  const runAnalysis = () => {
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
      setView("analyze");
      setSourceOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not extract readable text from this file.");
    } finally {
      setUploading(false);
    }
  };

  const loadFixture = (fixture: (typeof FIXTURES)[number]) => {
    setDocumentText(fixture.text);
    setDocumentName(`${fixture.title.toLowerCase().replace(/\s+/g, "-")}.txt`);
    setView("analyze");
    setSourceOpen(false);
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
            <button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button>
            <button className="avatar-button" aria-label="Workspace profile">AR</button>
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
                <div className="dropzone">
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

            <div className={classNames("workspace-grid", sourceOpen && "source-open")}>
              <section className="findings-column">
                <div className="results-head"><div><div className="eyebrow">RANKED SIGNALS / {context.toUpperCase()}</div><h2>{keptFindings.length ? "What deserves your attention" : "No findings above threshold"}</h2></div><div className="results-meta"><span className="model-badge"><span className="mini-dot" /> model + rules</span><span>{analysis.rawCandidateCount} candidates</span></div></div>
                <div className="honesty-note"><Info size={14} /><span>Filtering is threshold-based and tuned on a small demo dataset. It can miss unusually phrased important information or filter out something relevant. Adjust the slider if results seem too aggressive or noisy.</span></div>
                {keptFindings.length === 0 ? <div className="empty-state"><div className="empty-icon"><ListFilter size={24} /></div><h3>Nothing cleared the current bar.</h3><p>Lower the threshold to inspect lower-confidence candidates, or paste a document with more concrete requirements and dates.</p><button className="secondary-button" onClick={() => setThreshold(0.35)}>Reset threshold</button></div> : <div className="finding-list">{keptFindings.map((finding, index) => <FindingCard key={finding.id} finding={finding} index={index} onSource={openSource} />)}</div>}
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

function FindingCard({ finding, index, onSource }: { finding: Finding; index: number; onSource: (finding: Finding, sentenceId?: number) => void }) {
  const meta = CATEGORY_META[finding.category];
  return <article className="finding-card" style={{ "--category-color": meta.color, "--category-soft": meta.soft } as CSSProperties}>
    <div className="finding-rail"><span>{String(index + 1).padStart(2, "0")}</span><div className="finding-rule" /></div>
    <div className="finding-body"><div className="finding-top"><span className="category-label"><span className="category-dot" /> {finding.category}</span><span className="confidence-label">{finding.matchLabel} · {percent(finding.confidence)} confidence</span></div><p className="finding-sentence">{finding.sentence}</p><p className="finding-explanation">{finding.explanation}</p><div className="finding-footer"><button className="source-button" onClick={() => onSource(finding)}><ExternalLink size={14} /> View in source <span>· sentence {finding.occurrences[0].sentenceId + 1}</span></button><div className="finding-score"><span>relevance</span><strong>{finding.score.toFixed(2)}</strong></div></div>{finding.occurrences.length > 1 && <details className="occurrence-details"><summary><Layers3 size={13} /> Mentioned in {finding.occurrences.length} places <ChevronDown size={14} /></summary><div className="occurrence-list">{finding.occurrences.map((occurrence) => <button key={`${finding.id}-${occurrence.sentenceId}`} onClick={() => onSource(finding, occurrence.sentenceId)}>Sentence {occurrence.sentenceId + 1} <ArrowUpRight size={13} /></button>)}</div></details>}</div>
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
