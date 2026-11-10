# Look-Ahead — Product Requirements Document

The source of truth is **[PRD-v0.1.pdf](./PRD-v0.1.pdf)** (draft for review, November 8, 2026).

Quick reference:
- **Thesis:** the product wins by clearing constraints. Every constraint gets a named owner, a needed-by date and escalating visibility until it is cleared.
- **Primary user:** superintendent. Contributors: trade foreman, PM / field engineer, CxA. Viewer: owner's rep.
- **V1 scope:** pre-commissioning (commissioning levels L2–L3, with L4–L5 shown as targets), one pilot project, FR-01 to FR-15.
- **Horizons:** one rolling plan seen through 3-week (make-ready), 4-week (saved filter) and 6-week (lookahead) windows, plus the 1-week Weekly Work Plan.
- **Core objects:** Activity, Constraint, Area/System, Equipment, Milestone, Commitment.
- **Readiness:** READY / CONSTRAINED / AT RISK, computed from linked constraints. Overrides are logged.
- **V1 data in:** manual entry, CSV import and P6 file import (decision D-1). Procore and BIM sync are Phase 2.
- **Metrics:** PPC, delay reduction, constraint clearance, RFI cycle time.

Decisions and open questions (OQ-1 to OQ-6) are tracked in `decisions.md`.
