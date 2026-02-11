# Roadmap Implementation Strategy (90 Days)

Date: 2026-02-11
Scope: Execute Stage 0 governance + delivery sequencing for roadmap items in `feature_roadmap`.

## Current Baseline
- Total items: 28
- Status: all currently `planned`
- Priority mix: 6 critical, 6 high, 10 medium, 6 low
- Phase mix: 7 phase1, 8 phase2, 7 phase3, 6 backlog
- Effort mix: 6 large, 17 medium, 5 small

## Stage 0 Completed (This Update)
- Populated `assigned_to`, `target_version`, and `related_items` for all phase1/phase2 items.
- Established release train targets:
  - Phase 1: `3.10.0` through `3.10.6`
  - Phase 2: `3.11.0` through `3.11.7`

## Delivery Principles
1. Build shared engines before feature-specific UI.
2. Keep at most one `large` item actively in implementation at a time.
3. Every completed item must include:
   - API coverage for core calculations and edge cases
   - UI interaction tests for primary workflows
   - `bin/smoke-demo-prod` pass after deploy
4. Move status in DB as work changes: `planned` -> `in_progress` -> `completed`.

## Workstreams
- `tax-engine`: Tax, SS, Roth, RMD, estate/tax optimization dependencies
- `backend-modeling`: Healthcare and deterministic projection layers
- `scenario-engine`: Scenario and sequence-risk analytics
- `planning-analytics`: Insurance/pension/education/income modeling
- `frontend-analytics`: Visualization and comparison UX
- `planning-ux`: Guided flows and user-facing planning tools

## 90-Day Sprint Board

### Sprint 1 (Weeks 1-2)
Goal: Shared projection foundation + first critical tax output.
- 1) Healthcare & Medicare Planning Module (`3.10.0`, owner `backend-modeling`) [start backend model/API contract]
- 2) RMD Calculator & QCD Planning (`3.10.3`, owner `tax-engine`) [first production slice]
Exit criteria:
- RMD endpoint results validated with tests
- healthcare projection schema merged and versioned

### Sprint 2 (Weeks 3-4)
Goal: Claiming and conversion optimization on common tax outputs.
- 1) Social Security Optimization Tool (`3.10.1`, owner `tax-engine`)
- 2) Roth Conversion Optimizer (`3.10.2`, owner `tax-engine`)
Exit criteria:
- SS + Roth endpoints integrated with unified tax-year assumptions
- comparison UI paths available and test-covered

### Sprint 3 (Weeks 5-6)
Goal: Remaining phase1 items and rollout hardening.
- 1) Sequence of Returns Risk Visualization (`3.10.5`, owner `frontend-analytics`)
- 2) Life Insurance Needs Analysis (`3.10.4`, owner `planning-analytics`)
- 3) Debt Management & Payoff Strategies (`3.10.6`, owner `planning-ux`)
Exit criteria:
- release `3.10.x` complete
- phase1 items moved to `completed` as accepted

### Sprint 4 (Weeks 7-8)
Goal: Start phase2 with low-coupling high-value items.
- 1) Investment Fee Impact Analyzer (`3.11.3`, owner `frontend-analytics`)
- 2) Part-Time Work in Retirement Modeling (`3.11.4`, owner `planning-ux`)
- 3) 529 College Savings Planner (`3.11.0`, owner `planning-analytics`)
Exit criteria:
- 3 phase2 items shipped with docs + smoke pass

### Sprint 5 (Weeks 9-10)
Goal: Advanced planning comparisons.
- 1) Pension vs Lump Sum Analyzer (`3.11.1`, owner `planning-analytics`)
- 2) Estate Tax & Gifting Strategy (`3.11.2`, owner `tax-engine`)
Exit criteria:
- pension comparison and gifting strategy test suites complete

### Sprint 6 (Weeks 11-12)
Goal: Close phase2 dependency-heavy items.
- 1) Detailed Tax Bracket Optimization (`3.11.5`, owner `tax-engine`)
- 2) Real Estate Enhancements (`3.11.6`, owner `planning-analytics`)
- 3) Advanced Scenario Analysis (`3.11.7`, owner `scenario-engine`)
Exit criteria:
- release `3.11.x` complete
- phase2 items moved to `completed` or explicit `on_hold` with reason

## Governance Cadence
- Weekly roadmap triage (30 min): status updates, blockers, scope control.
- Bi-weekly release readiness review:
  - migration impact
  - backward compatibility
  - smoke/test health
- Monthly strategy checkpoint:
  - re-prioritize phase3/backlog using customer usage + defect trends.

## Immediate Next Actions
1. Set first two sprint items (`id=1`, `id=4`) to `in_progress` when implementation starts.
2. Create issue tickets from each phase1 item with acceptance criteria from this plan.
3. Track completion notes in `feature_roadmap.notes` per item at deploy time.
