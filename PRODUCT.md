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

## Continuous learning loop

My Voice must learn from explicit before-and-after correction pairs. After a draft is generated with a published voice skill, the user can paste the generated draft beside their edited final version, identify changes the model misunderstood, and decide which lessons should be remembered. The app classifies proposed lessons as durable voice guidance, context-only guidance, a one-time change, or a wrong interpretation. Nothing becomes durable without approval.

The correction record keeps the task, audience, selected voice area, profile version, generated draft, final revision, decision, and evidence links. A rejected interpretation remains recorded so the same unsupported lesson is not repeatedly proposed. Approved lessons create a reversible profile version and can be republished as a new skill version.

## Modular skill package

The published skill is a small router rather than one ever-growing instruction file. `SKILL.md` contains the skill name, description, selection rules, conflict priority, and links to focused Markdown references. Voice areas can be added or renamed without changing the learning model. Initial areas are:

- personal email;
- business email;
- website copy;
- general voice guidance.

Each area has its own reference file and contains only approved rules and examples relevant to that area. A writing request can explicitly select one area, and the skill loads only the shared core plus that reference. The package includes a manifest with the profile version, area identifiers, checksums, and publication timestamp so the app can detect external edits and verify which version Codex used.

## Runtime model

My Voice uses the user's authenticated Codex installation and defaults routine analysis and drafting to `gpt-5.6-luna` at medium reasoning. High reasoning is reserved for ambiguous correction classification, conflict resolution, and profile synthesis. Max reasoning is an explicit retry for unusually difficult cases, never an automatic default. Local import, profile review, version history, and skill export continue to work when Codex is unavailable.

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
- A generated draft and the user's revision can be fed back into the app, producing traceable decisions without silently retraining or overgeneralizing.
- Profile versions remain reversible and skill compilation is recoverable.
- The published skill can select one voice area without loading unrelated area files, and its selected profile version can be verified.
- Invalid input, malformed AI output, cancellation, and source deletion cannot silently corrupt the profile.
- The interface remains usable with keyboard navigation and reads clearly in light and dark appearance.
