# Phase 16: Strategy & Checklist Enhancements - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Traders can customize checklists for individual trades, always have useful default strategies available out of the box, and see checklist completion at a glance on trade/journal cards. Covers per-trade checklist editing, ad-hoc checklist items, built-in default strategies, completion score display, and consolidating strategy definitions to a single source.

</domain>

<decisions>
## Implementation Decisions

### Built-in Default Strategies
- 5 built-in strategies, each with max 5 checklist items:
  1. **Wyckoff** (unified buy/sell — single strategy that works for both directions)
  2. **SMC** (Smart Money Concepts)
  3. **Breakout**
  4. **Reversal**
  5. **150 SMA**
- Built-ins are **editable** by users (not read-only like dashboard templates)
- **Seed once on first load**: if no `strategies` setting exists, populate from `lib/strategies.ts`. After that, user owns them completely. Deleting all = empty list (no re-seeding)
- All default strategy definitions consolidated to `lib/strategies.ts` (single source of truth, STRAT-05)

### Per-trade Checklist Editing
- **Inline edit in modal**: add/edit/remove buttons directly on each checklist item within the existing StrategyChecklist section
- Edits only affect the current trade, not the strategy template
- **Copy-on-select**: selecting a strategy snapshots its checklist items into the trade's `checklist_state`. Future template edits don't affect existing trades
- **New `checklist_state` column** (DB migration 022): stores full checklist as JSON — array of `{ text: string, checked: boolean }` objects. Replaces reliance on comma-separated `checklist_items`
- **Confirm before replacing**: when switching strategies on a trade with existing checked items, show a warning dialog before resetting

### Completion Score Display
- **Progress ring** (small circular donut chart) on both trade list rows and journal review cards
- Counts **all items** (template + ad-hoc) in the completion calculation
- **No badge** if a trade has no checklist data — only trades with checklists get the ring
- Ring shows checked/total ratio visually

### Ad-hoc Checklists
- **Free-text input field** with Add button appears at the bottom of the checklist section
- **"No Strategy" option** added as the first item in the strategy dropdown — selecting it clears template items and shows the free-text input for custom items
- **Can extend any checklist**: the Add input appears whether a strategy is selected or not — users can always add custom items on top of strategy items
- **No visual distinction** between template-sourced and ad-hoc items — once copied to the trade, all items are equal

### Claude's Discretion
- Exact checklist item text for each of the 5 default strategies
- Progress ring sizing, colors, and animation
- Migration strategy for existing `checklist_items` data to new `checklist_state` format
- Inline edit button placement and interaction patterns

</decisions>

<specifics>
## Specific Ideas

- Wyckoff strategy should be a single unified strategy that works for both buy and sell setups (not split into separate buy/sell strategies like current implementation)
- The 5 strategies are specifically: Wyckoff, SMC, Breakout, Reversal, 150 SMA — user-specified, not generic

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StrategyChecklist` component (`TradeModal.tsx:537`): renders strategy dropdown + toggle-able checklist items — extend for inline editing and ad-hoc input
- `StrategiesTab.tsx`: full CRUD for strategy templates with drag-reorder — already has add/remove/edit patterns
- `TradeStrategy` type (`lib/types.ts:92`): `{ id: string, name: string, checklist: string[] }` — reuse for `lib/strategies.ts`
- `AlertModal` component: can be used for the "confirm before replacing" dialog when switching strategies

### Established Patterns
- Strategies stored as JSON string in `/api/settings` key `strategies`
- `DEFAULT_STRATEGIES` currently hardcoded in `TradeModal.tsx` (2 Wyckoff strategies, 9 items each) — to be moved to `lib/strategies.ts`
- `checklist_items` column stores comma-separated checked item text — to be superseded by `checklist_state` JSON column
- `strategy_id` column on trades already exists (migration 016)

### Integration Points
- `TradeModal.tsx` StrategyChecklist section: primary UI integration point for per-trade editing + ad-hoc input
- `lib/db.ts`: migration 022 for `checklist_state` column
- `app/trades/page.tsx`: trade list rows need progress ring badge
- `app/journal/page.tsx`: journal cards need progress ring badge
- `/api/trades/route.ts` and `/api/trades/[id]/route.ts`: need to handle `checklist_state` in CRUD operations

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-strategy-checklist-enhancements*
*Context gathered: 2026-03-21*
