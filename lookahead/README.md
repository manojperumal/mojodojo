# Look-Ahead

A short-interval (2/3/4/6-week) look-ahead scheduling tool for construction field teams —
superintendents and project engineers. Standalone app, separate from Pre-qual.

> Status: workspace scaffold. Scope will be defined by `docs/PRD.md`.

## Primary users
- **Superintendent** — builds and runs the weekly look-ahead with trade foremen.
- **Project Engineer** — maintains activities, constraints (RFIs, submittals, deliveries), and imports.

## Activity sources
Activities flow into one common activity model from several sources:

| Source | Folder | Notes |
|---|---|---|
| Primavera P6 | `integrations/p6/` | XER / XML export of the master schedule |
| Procore | `integrations/procore/` | API sync (schedule, RFIs, submittals) |
| CSV / Excel | `integrations/csv/` | Template-based import |
| Manual entry | `client/` | Entered directly in the app |

## Layout
```
lookahead/
├── docs/            PRD and design notes
├── client/          Web front end
├── server/          API and import jobs
├── db/migrations/   Database schema
├── integrations/    P6, Procore, CSV importers
└── samples/         Sample schedules/exports for testing imports
```

The tech stack hasn't been decided yet; it will be set once the PRD is in.
