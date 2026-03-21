# Phase 15: Dashboard Layout Templates - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can save their current dashboard widget arrangement as a named template and restore it at any time. Includes save, load, and delete operations plus 2 built-in preset templates. Template controls are accessible from the edit mode toolbar without leaving the dashboard.

</domain>

<decisions>
## Implementation Decisions

### Built-in Presets
- 2 built-in presets: **Performance Review** and **Daily Monitor**
- Performance Review: all analytics widgets visible (charts, tables, stats) — full deep-dive layout
- Daily Monitor: compact morning check-in — today's P&L, market gauges (fear/greed, VIX, market overview), heatmap, and quick stats
- Built-in presets are **read-only** — users cannot overwrite or delete them
- Users can duplicate a built-in preset to create their own editable copy ("Save as...")
- The existing Reset button continues to restore `DEFAULT_ORDER` — it is NOT replaced by a preset

### Template Scope
- Template **library is global** (user-level) — all templates appear regardless of active account
- **Active layout is per-account** — each account tracks its own currently applied layout independently
- "All Accounts" view (activeAccountId = null) has its own layout state, treated like its own account
- Templates store **widget layout only** (order, hidden, sizes) — time filter is NOT included

### Claude's Discretion
- Template UI placement and controls design (dropdown, modal, inline panel)
- Save/load workflow details (naming prompt, confirmation step, overwrite behavior)
- Storage key structure for per-account active layouts
- Exact widget selection and sizing for each built-in preset

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardLayout` interface: `{ order: string[], hidden: string[], sizes: Record<string, WidgetSize> }` — template data shape
- `DEFAULT_ORDER`, `DEFAULT_HIDDEN`, `DEFAULT_SIZES` constants — baseline for Reset and reference for presets
- `ALL_WIDGETS` array (38 widgets) with `WIDGET_MAP` — widget registry
- `saveLayout()` function with debounced save to `/api/settings` — pattern to extend for templates
- Edit mode toolbar (pill-shaped button group) — integration point for template controls

### Established Patterns
- Settings stored as JSON strings via `/api/settings` key-value store
- `dashboard_layout` key stores active layout — extend with `dashboard_layout_templates` for template library
- Edit mode toggle with conditional toolbar buttons (reset appears only in edit mode)
- `SIZE_CYCLE` array for cycling widget sizes: large -> medium -> compact

### Integration Points
- `DashboardShell.tsx` edit mode toolbar (line ~947-979) — where template controls will be added
- `/api/settings` GET/POST — storage backend for both template library and per-account active layouts
- `resetLayout()` function (line ~719) — existing pattern for applying a layout wholesale
- `useAccounts` hook provides `activeAccountId` — key for per-account layout storage

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-dashboard-layout-templates*
*Context gathered: 2026-03-20*
