import { getReviewSession, type ReviewSession } from "./actions";
import { ReviewRunner } from "@/components/game/ReviewRunner";

/**
 * The review session.
 *
 * Reuses the Hunt run loop rather than building a second one — a review is the
 * batch from the SM-2 schedule, with untimed learning and due-date order.
 */
export default async function ReviewPage() {
  let session: ReviewSession | null = null;
  try {
    session = await getReviewSession();
  } catch {
    // The runner offers retry rather than a false empty queue.
  }
  return <ReviewRunner initialSession={session} />;
}
