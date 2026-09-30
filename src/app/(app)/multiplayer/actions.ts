'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Seeds and starts a multiplayer room, via `start_multiplayer_quiz_rpc`
 * (migration 0049).
 *
 * This used to select `correct_choice_index` from `questions` as the
 * signed-in host, then insert it into `quiz_room_questions.correct_index`
 * from here — a select against the same two columns `quiz-service.ts` has
 * always avoided, just for a different table. It is now one function: the
 * host check, the question selection and the write all happen server-side in
 * a single call, which also closes a small race the old two-step version
 * had (two rapid calls could each pass the host check and both seed the
 * room).
 */
export async function startMultiplayerQuiz(roomId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');

  const { error } = await supabase.rpc('start_multiplayer_quiz_rpc', {
    p_room_id: roomId,
  });

  if (error) throw new Error(error.message || 'Could not start the quiz.');
}

/**
 * Host-only: advance the room to the next question, or finish the quiz if
 * the current question was the last one. Returns true when the quiz has
 * finished, false if there's another question to show.
 */
export async function advanceQuestion(roomId: string, expectedQuestion: number): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const { data, error } = await supabase.rpc('advance_multiplayer_question_rpc', {
    p_room_id: roomId, p_expected_question: expectedQuestion,
  });
  if (error) throw new Error(error.message || 'Could not advance the quiz.');
  return data === true;
}

/** Any participant can complete an elapsed countdown if the host disconnects. */
export async function beginMultiplayerQuiz(roomId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const { error } = await supabase.rpc('begin_multiplayer_quiz_rpc', { p_room_id: roomId });
  if (error) throw new Error(error.message || 'Could not begin the quiz.');
}
