import assert from "node:assert/strict";
import { questionTimeLeft, secondsUntil } from "../src/lib/hunt-clock";
import { applyAnswer, buildFixedLadder, endRun, initialState } from "../src/lib/hunt-engine";

const start = 1000;
const deadline = start + 30000;
assert.equal(secondsUntil(deadline, start), 30);
assert.equal(secondsUntil(deadline, start + 12345), 18, "Delayed callbacks must catch up to elapsed time");
assert.equal(secondsUntil(deadline, start + 60000), 0, "A sleeping tab cannot gain time");
assert.equal(secondsUntil(deadline, deadline), 0);
assert.equal(questionTimeLeft(start, 30, 0, start + 8000), 22000);
assert.equal(questionTimeLeft(start, 30, 15000, start + 8000), 37000, "A boost extends the original deadline by exactly 15 seconds");
assert.equal(questionTimeLeft(start, 30, 15000, start + 40000), 5000);
assert.equal(questionTimeLeft(start, 30, 0, start + 34000), 0, "Retry latency does not refund question time");

const ladder = buildFixedLadder([{ id: "question", text: "Sample", options: ["A", "B"], difficulty: "Beginner", tier: 1, points: 10, timeLimit: 30 }]);
const result = endRun(applyAnswer(initialState(ladder), { correct: true, xpEarned: 10, msLeft: 10 }), "won");
assert.equal(result.correct, 1, "A committed answer that settles at expiry must stay in the summary");
assert.equal(result.xp, 10);
assert.equal(applyAnswer(result, { correct: true, xpEarned: 10, msLeft: 10 }).xp, 10);
console.log("Solo deadlines: delayed ticks, expiry, boost duration, retries and final-answer accounting passed.");
