# Portfolio status updates

The live portfolio is designed so normal milestone updates happen from one source:

`data/portfolio-state.json`

## Normal update workflow

1. Change the relevant item's `status`, `statusDate`, `evidence` and optional `note`.
2. Append the previous/current state to that item's `history` instead of deleting meaningful history.
3. Set `nextState` only to the next *possible verified state*. It is not a prediction.
4. Add a factual entry to `changelog` only when the portfolio itself changes materially.
5. Commit. The page automatically updates the current-status dashboard, academic cards, project/research status lines, status history and milestone timeline.

## Example: IITM qualifier becomes qualified

Change:

```json
"status": "QUALIFIER PATHWAY",
"statusDate": "SEP 2026",
"nextState": "QUALIFIED"
```

to the verified state, for example:

```json
"status": "QUALIFIED",
"statusDate": "NOV 2026",
"nextState": "ADMITTED"
```

Then append a `QUALIFIED` history object with the actual evidence type/date. Do not remove the earlier `QUALIFIER PATHWAY` history.

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
  --next="ADMITTED" \
  --as-of="NOV 2026" \
  --changelog="IIT Madras qualifier status updated"
```

The helper appends the new state to history instead of overwriting the old history. Review the JSON diff before committing. Evidence labels/links can also be supplied with `--evidence-label` and `--evidence-href`.
