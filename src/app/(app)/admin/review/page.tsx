import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GenerateForm } from './GenerateForm';
import { QuestionReviewCard, type ReviewQuestion } from './QuestionReviewCard';
import { ShieldCheck } from 'lucide-react';

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'reviewer' && profile.role !== 'admin')) {
    redirect('/home');
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order');

  // `reviewer_pending_questions` (migration 0049) replaces a direct select
  // of `correct_choice_index, explanation` as `authenticated` — the same two
  // columns `quiz-service.ts` has always avoided reading, now actually
  // unreadable outside a SECURITY DEFINER function. It re-checks the
  // reviewer/admin role itself, so this page's own redirect above and the
  // function's gate agree rather than one being load-bearing on trust.
  const { data: pending, error: pendingError } = await supabase.rpc('reviewer_pending_questions');

  const reviewQuestions: ReviewQuestion[] = (pending ?? []).map((row: any) => ({
    id: row.o_id,
    question_text: row.o_question_text,
    choices: row.o_choices,
    correct_choice_index: row.o_correct_choice_index,
    explanation: row.o_explanation,
    citation_reference: row.o_citation_reference,
    madhab_tag: row.o_madhab_tag,
    difficulty: row.o_difficulty,
    language: row.o_language,
    categoryName: row.o_category_name ?? 'Unknown',
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Content review</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        AI-drafted questions land here first. Nothing reaches players until a reviewer approves it. Check every citation before publishing.
      </p>

      <GenerateForm categories={categories ?? []} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Pending review ({reviewQuestions.length})
        </h2>
        {pendingError && (
          <p role="alert" className="text-sm text-destructive">Could not load the review queue. Refresh this page to try again.</p>
        )}
        {!pendingError && reviewQuestions.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nothing waiting. Draft a batch above to get started.</p>
        )}
        {reviewQuestions.map(q => (
          <QuestionReviewCard key={q.id} q={q} />
        ))}
      </div>
    </div>
  );
}
