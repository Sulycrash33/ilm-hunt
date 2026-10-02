/**
 * Narration reader checks.
 *
 * `splitNarration` decides what the hadith of the day says, on the front door
 * of the app, in six languages. It is one regex either side of a guard, which
 * is precisely the kind of code that looks obviously right and quietly eats a
 * sentence. Every fixture below is a real row from `hadith_translations` —
 * including the two that broke earlier drafts.
 *
 *   npm run test:narration
 */

import { splitNarration, spaceAfterColons } from "../src/lib/narration";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { failures += 1; console.log("FAIL:", name, extra ?? ""); }
  else console.log("ok  :", name);
}

// ---------------------------------------------------- the shape being fixed
const bukhari6469 =
  "Narrated Abu Huraira:I heard Allah's Messenger (صلى الله عليه وسلم) saying, Verily Allah created Mercy.";
{
  const { narrator, body } = splitNarration(bukhari6469);
  check("lifts the narrator out of the text", narrator === "Abu Huraira", narrator);
  check("the body starts at the narration", body.startsWith("I heard Allah's Messenger"), body.slice(0, 40));
  check("the word Narrated does not survive in the body", !body.includes("Narrated"));
}

// A row that already has the space. Same result, so the fix is not conditional
// on the typo it was written for.
check("a spaced colon reads the same",
  splitNarration("Narrated Anas: The Prophet (ص) said, \"Whoever…\"").narrator === "Anas");

// Someone typing a row correctly at /admin/hadiths must not get "by by".
check("an existing 'by' is not doubled",
  splitNarration("Narrated by Anas:The Prophet said…").narrator === "Anas");

// The longest real chain in the table.
check("a parenthesised chain survives whole",
  splitNarration("Narrated 'Ata (while Abu Huraira was narrating (see previous hadith)):The Prophet…").narrator
    === "'Ata (while Abu Huraira was narrating (see previous hadith))");

// Backticked and apostrophed transliterations are most of the table.
check("transliteration marks are kept",
  splitNarration("Narrated `Abdur-Rahman bin Abi Bakra's father:The Prophet…").narrator
    === "`Abdur-Rahman bin Abi Bakra's father");

// ------------------------------------------------------------- idempotence
{
  const once = splitNarration(bukhari6469);
  const twice = splitNarration(once.body);
  check("running it twice changes nothing", twice.narrator === null && twice.body === once.body);
}

// ------------------------------------------------------- what must be left
// 89 English rows carry no chain at all. The colon still gets its space; the
// clause before it is a speaker inside the narration, not an isnad, and
// hoisting it to a heading would misattribute the hadith.
{
  const { narrator, body } = splitNarration("Abdullah added:The Prophet (ص) said, \"I am your predecessor…\"");
  check("a mid-text speaker is not promoted to narrator", narrator === null, narrator);
  check("but its colon still gets a space", body.startsWith("Abdullah added: The Prophet"), body.slice(0, 30));
}

// The citation that broke the first draft of the colon rule.
check("a Qur'an citation is not split",
  spaceAfterColons("the following Verse was revealed: \"…wrong\" (6:83), the companions")
    === "the following Verse was revealed: \"…wrong\" (6:83), the companions");
check("a verse range is not split",
  spaceAfterColons("with knowledge (Quran 11:45-46), and he") === "with knowledge (Quran 11:45-46), and he");

// The bracket that broke the second draft.
check("a colon before a closing bracket is left alone",
  spaceAfterColons("an-Nawawi says:] We have related") === "an-Nawawi says:] We have related");

// A colon before an opening quote is a real one and does get its space.
check("a colon before a quotation is spaced",
  spaceAfterColons("(beginning with):\"The mutual rivalry\"") === "(beginning with): \"The mutual rivalry\"");

// ------------------------------------------------------- the other locales
// Nothing here may touch them. The Arabic and French editions were typeset
// properly and any "repair" applied to them is damage.
const arabic = "أَخْبَرَنَا قُتَيْبَةُ بْنُ سَعِيدٍ، حَدَّثَنَا إِسْمَاعِيلُ";
check("Arabic is returned untouched",
  splitNarration(arabic).narrator === null && splitNarration(arabic).body === arabic);

const french = "Abu Sa`id a ajouté : « Comme vous voyez une étoile brillante »";
check("French is returned untouched",
  splitNarration(french).narrator === null && splitNarration(french).body === french);

const hausa = "A kan Usama - yardar Allah ta tabbata a gare shi - a kan annabi";
check("Hausa is returned untouched",
  splitNarration(hausa).narrator === null && splitNarration(hausa).body === hausa);

// ------------------------------------------------------------------ nothing
check("empty text does not throw", splitNarration("").body === "" && splitNarration("").narrator === null);
check("a heading-only imported entry does not become an empty quotation",
  splitNarration("Narrated Abu Huraira: ").narrator === null
    && splitNarration("Narrated Abu Huraira: ").body === "Narrated Abu Huraira:");
const longBody = "A complete sentence with a reference (6:83). ".repeat(300);
check("a long narration retains its entire body",
  splitNarration(`Narrated Anas:${longBody}`).body === longBody.trim());

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
