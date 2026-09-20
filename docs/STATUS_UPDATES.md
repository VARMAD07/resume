# Portfolio status updates

The live portfolio is designed so normal milestone updates happen from one source:

`data/portfolio-state.json`

## Normal update workflow

The same state file also controls the concise reviewer summary and current-status dashboard. `profile.stage`, `profile.stageDate` and `academics.school` carry the current school stage. Future-only paths such as `academics.engineering` use `dashboard: false` until they become a verified current academic state.

1. Change the relevant item's `status`, `statusDate`, `evidence` and optional `note`.
2. Append the verified state to that item's `history` instead of deleting meaningful history.
3. Do not store a separate `nextState`. The UI derives the next possible state from `transitionModels`, preventing stale "next" copy after a status change.
4. Add a factual entry to `changelog` only when the portfolio itself changes materially.
5. Commit. The page automatically updates the current-status dashboard, reviewer summary, academic cards, project/research status lines, derived next state, status history and milestone timeline.

## Example: IITM qualifier becomes qualified

Change:

```json
"status": "QUALIFIER PATHWAY",
"statusDate": "SEP 2026"
```

to the verified state, for example:

```json
"status": "QUALIFIED",
"statusDate": "NOV 2026"
```

Then append a `QUALIFIED` history object with the actual evidence type/date. Do not remove the earlier `QUALIFIER PATHWAY` history. The next possible state is then derived automatically as `ADMITTED` from the centralized transition model.

## Non-negotiable

Do not advance a status because a date arrived. Advance only when the underlying event happened and appropriate evidence exists.

The evergreen page title, hero identity and OG image intentionally do not contain temporary admissions states.


## Fast helper

For a normal milestone transition, the repository also includes:

`scripts/update_status.mjs`

Example:

```bash
node scripts/update_status.mjs academics.iitm \
  --status="QUALIFIED" \
  --date="NOV 2026" \
  --sort=20261100 \
  --evidence-type="PORTAL EVIDENCE" \
  --note="Qualifier milestone completed and supported by the updated portal record." \
  --as-of="NOV 2026" \
  --changelog="IIT Madras qualifier status updated"
```

The helper appends the new state to history instead of overwriting the old history. Review the JSON diff before committing. Evidence labels/links can also be supplied with `--evidence-label` and `--evidence-href`.


## IIT Madras course updates

The official curriculum snapshot used by the portfolio is:

`data/iitm-curriculum.json`

It was verified against the official IIT Madras BS Data Science and Applications Academics and Admissions pages in September 2026.

Personal course states live only in:

`data/portfolio-state.json → academics.iitm.courseStatuses`

The default for every curriculum course is `PLANNED`. Do not mark a course `CURRENT`, `COMPLETED`, `PASSED`, `REPEATED`, or `ARCHIVED` without an academic record supporting that state.

Fast helper:

```bash
node scripts/update_iitm_course.mjs BSMA1001 \
  --status="CURRENT" \
  --date="JAN 2027" \
  --evidence-type="PORTAL EVIDENCE" \
  --note="Registered course shown in the official academic record." \
  --as-of="JAN 2027"
```

The helper preserves course-status history and updates only the centralized state record.

When IIT Madras changes the official curriculum, update `data/iitm-curriculum.json` from the official programme pages first. Do not preserve an old course list simply because the portfolio previously used it.


## IITM curriculum architecture

The portfolio separates two things deliberately:

- **Official source data:** `data/iitm-curriculum.json → officialStructure / courses`
- **Portfolio learning architecture:** `data/iitm-curriculum.json → learningArchitecture`

The learning architecture is a six-part explanatory view:

1. Foundation
2. Programming
3. Data Science
4. Machine Learning / AI
5. Systems
6. Elective / Advanced Learning

These are portfolio groupings, not replacements for IIT Madras's official Foundation / Diploma / Degree structure. Every displayed course retains its official level in the external curriculum data.

The advanced/elective group is explicitly volatile because IIT Madras states that elective availability may change by term. Re-verify the official Academics page before treating an elective as currently offered after the curriculum review date.

Do not hard-code new course names into `index.html`. Update `data/iitm-curriculum.json` from the official IIT Madras programme page, then let the UI render it.
