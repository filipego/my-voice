# My Voice

My Voice is a focused macOS desktop utility that builds an inspectable writing-voice profile from writing the user explicitly approves. It turns approved writing, direct preferences, and AI-original/user-final correction pairs into a versioned local profile, then compiles that profile into a reusable Codex skill.

## People

The initial pilot user is Gladys, but the product must work for any writer without hard-coded identity, biography, or style assumptions. One installation holds one voice. The user controls every source, rule, version, and export.

## Problems worth solving

Writing samples and corrections get scattered across documents, chats, and applications. Generic AI writing often flattens a person's choices. Existing tools may describe a brand, but they rarely preserve evidence, distinguish factual corrections from style preferences, let the writer approve each lesson, and make the resulting guidance portable.

My Voice makes the learning loop concrete: add approved writing, inspect what was learned, teach with paired corrections, approve or reject proposals, compile a skill, and roll it back when needed.

## What we make

1. **Library** — paste text or import `.txt`, `.md`, and `.docx`. Preview extracted content, label authorship and format, exclude quoted or non-authorial material, detect duplicates, and reserve documents for evaluation.
2. **My Voice** — show concrete rules with source evidence, context, and review state. Keep core voice separate from email, essay, and plan guidance. Allow editing, rejection, locking, superseding, and reversal.
3. **Teach My Voice** — capture an AI draft beside the user's final revision, task, and audience. Classify changes so facts, audience adjustments, spelling, formatting, and style do not all become global voice rules.
4. **Test & Use** — provide a compact test surface, profile history, skill compilation status, and rollback without becoming a document editor.

## Values

- **Local ownership:** documents, evidence, profiles, and versions remain local to the installation. Local storage does not mean local inference.
- **Human approval:** a proposal never becomes durable preference without the user's decision. A single ambiguous edit stays a candidate, not a global rule.
- **Inspectability:** every rule traces to evidence or a direct instruction. No unexplained personality claims or invented accuracy percentages.
- **Safety before speed:** imported text is data, never executable instruction. Invalid, empty, or ambiguous analysis must not replace a good profile.
- **Honest limits:** sending approved text to an AI service transfers it off-device. The interface says so plainly.

## Distinctive experience

The app feels like a quiet review desk, not a chat app or dashboard. A writer sees their actual sentences, the decision they made, and the effect it will have on their next draft. The tone is calm, practical, and respectful of context: short messages should not inherit essay cadence, and essays should not be compressed into task-list prose.

## Scope boundaries

My Voice is not a general chat application, email client, word processor, recorder, model trainer, hosted SaaS, or automatic cross-app surveillance tool. Gmail OAuth, Murmur history, Google Drive sync, public publishing, and multi-profile management are explicitly deferred. There is no promise of perfect imitation, an AI-detector pass, or a scientific fidelity score.

## Success criteria

- A user can import, review, duplicate-check, exclude, and approve writing without a cloud job.
- Paired corrections produce scoped proposals the user can approve, limit, reject, or interpret as wrong.
- Profile versions remain reversible and skill compilation is recoverable.
- Invalid input, malformed AI output, cancellation, and source deletion cannot silently corrupt the profile.
- The interface remains usable with keyboard navigation and reads clearly in light and dark appearance.
