"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumCard } from "@/components/ui/premium-card";
import { getQuestionQualityReport } from "@/app/(app)/admin/questions/actions";
import { QUALITY_LABELS, type QualityIssue, type QualityReport, type QualityRule } from "@/lib/question-quality";

export function QuestionQualityPanel({ onOpen, disabled = false }: { onOpen: (issue: QualityIssue) => void; disabled?: boolean }) {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState<QualityRule | "all">("all");
  const [page, setPage] = useState(0);
  const pending = useRef(false);
  const epoch = useRef(0);
  useEffect(() => () => { epoch.current++; }, []);
  async function scan() {
    if (pending.current) return;
    pending.current = true;
    const requestEpoch = epoch.current;
    setLoading(true); setError(null);
    try {
      const result = await getQuestionQualityReport();
      if (epoch.current !== requestEpoch) return;
      if (!result.ok) { setError(result.error); return; }
      setReport(result.report); setPage(0);
    } catch {
      if (epoch.current === requestEpoch) setError("Could not scan questions. Please try again.");
    } finally {
      if (epoch.current === requestEpoch) { pending.current = false; setLoading(false); }
    }
  }
  const issues = report?.issues.filter(issue => rule === "all" || issue.reasons.includes(rule)) ?? [];
  const pages = Math.max(1, Math.ceil(issues.length / 10));
  return <PremiumCard className="mb-6 space-y-4 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface"><SearchCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />Content quality</h2>
        <p className="text-sm text-on-surface-variant">Find vague curriculum references, repeated wording and answer-choice problems in published questions. Review each flag before editing or rejecting it.</p>
      </div>
      <Button onClick={() => void scan()} disabled={loading} variant="outline">{loading && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{loading ? "Scanning…" : report ? "Scan again" : "Scan published questions"}</Button>
    </div>
    {loading && <p role="status" className="text-sm text-on-surface-variant">Checking the published bank. This can take a moment.</p>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {report && !loading && !error && <>
      <p className="flex items-center gap-2 text-sm text-on-surface-variant" role="status">{report.issues.length ? <AlertTriangle className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}{report.scanned.toLocaleString()} checked · {report.issues.length.toLocaleString()} flagged for review{!report.complete && " · partial scan"}</p>
      <p className="text-xs text-on-surface-variant">These writing checks do not verify factual accuracy or record scholar approval.</p>
      <p className="text-xs text-on-surface-variant">Last scan: {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}</p>
      {report.issues.length > 0 && <>
        <label className="block text-sm text-on-surface-variant">Filter quality flags
          <select value={rule} onChange={event => { setRule(event.target.value as QualityRule | "all"); setPage(0); }} className="mt-1 block w-full rounded-lg border border-white/15 bg-surface-container p-2 text-on-surface">
            <option value="all">All flags</option>
            {Object.entries(QUALITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div className="space-y-3">
          {issues.slice(page * 10, page * 10 + 10).map(issue => <div key={issue.id} className="space-y-2 rounded-xl border border-white/10 p-3">
            <p className="text-xs text-on-surface-variant">{issue.category ?? "Uncategorised"} · Tier {issue.tier ?? "—"}</p>
            <p className="break-words text-sm font-medium text-on-surface">{issue.text || "Empty question"}</p>
            <ul className="list-disc space-y-1 ps-5 text-xs text-secondary">{issue.reasons.map(reason => <li key={reason}>{QUALITY_LABELS[reason]}</li>)}</ul>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => onOpen(issue)}>Find in question bank</Button>
          </div>)}
          {issues.length === 0 && <p className="text-sm text-on-surface-variant">No questions match this flag.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-on-surface-variant">{issues.length} matching · page {page + 1} of {pages}</p>
          <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous flags</Button><Button size="sm" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Next flags</Button></div>
        </div>
      </>}
    </>}
  </PremiumCard>;
}
