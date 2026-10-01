/** Writing checks for human review. They do not decide factual accuracy. */
export const QUALITY_LABELS = {
  context: "Depends on another lesson, tier or category",
  blankText: "Question text is empty",
  fewChoices: "Fewer than two choices",
  blankChoice: "An answer choice is empty",
  duplicateChoice: "Answer choices repeat",
  reusedStem: "Question wording is reused",
} as const;

export type QualityRule = keyof typeof QUALITY_LABELS;
export interface QualityQuestion {
  id: string;
  text: string;
  choices: string[];
  category: string | null;
  categoryId: string | null;
  tier: number | null;
}
export interface QualityIssue extends Omit<QualityQuestion, "choices"> {
  reasons: QualityRule[];
}
export interface QualityReport {
  scanned: number;
  complete: boolean;
  checkedAt: string;
  issues: QualityIssue[];
}

function normalise(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function questionQualityReasons(question: Pick<QualityQuestion, "text" | "choices">): QualityRule[] {
  const reasons: QualityRule[] = [];
  if (!question.text.trim()) reasons.push("blankText");
  // Quizzes shuffle questions, so references to a course sequence need review.
  // Keep this advisory: a quoted phrase may be intentional, and the checker
  // does not reject a question or infer whether its religious content is sound.
  const courseReference = /\b(?:(?:this|previous|prior|earlier|next|capstone)\s+(?:category|tiers?|lessons?)|(?:tiers?|lessons?)\s+(?:[1-9]\b|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b)|(?:texts?|reports?|material)\s+covered\s+so\s+far)\b/i;
  if (courseReference.test(question.text)) reasons.push("context");
  if (question.choices.length < 2) reasons.push("fewChoices");
  if (question.choices.some(choice => !choice.trim())) reasons.push("blankChoice");
  const choices = question.choices.map(normalise).filter(Boolean);
  if (new Set(choices).size < choices.length) reasons.push("duplicateChoice");
  return reasons;
}

/** Check the whole scanned set, so duplicates across pages are not missed. */
export function reviewQuestionQuality(questions: readonly QualityQuestion[]): QualityIssue[] {
  const stems = new Map<string, number>();
  for (const question of questions) {
    const stem = normalise(question.text);
    if (stem) stems.set(stem, (stems.get(stem) ?? 0) + 1);
  }
  return questions.flatMap(question => {
    const reasons = questionQualityReasons(question);
    if ((stems.get(normalise(question.text)) ?? 0) > 1) reasons.push("reusedStem");
    if (!reasons.length) return [];
    const { choices: _choices, ...visible } = question;
    return [{ ...visible, reasons }];
  });
}
