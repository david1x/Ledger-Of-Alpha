# Phase 28: Layout Persistence and Migration - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure resized layouts persist across sessions and existing saved templates work with the new {w, h} dims schema. The persistence infrastructure (saveLayout, load migration) already exists from Phase 27 — this phase closes gaps in user-saved template migration and hardens edge cases.

</domain>

<decisions>
## Implementation Decisions

### User-saved template migration
- Lazy migration on load: when a user-saved template is loaded via `handleLoadTemplate`, detect old format (has `sizes` but no `dims`, or `dims` without `_gridScale`) and upscale to 24-col before applying
- Same migration logic already used for `admin_default_templates` (lines 461-483) — extract and reuse
- No batch migration needed — templates are migrated when the user actually loads them

### Save timing
- Keep existing 1s debounce for drag-reorder and hide/show operations
- Keep immediate save for resize (already done via `handleResizePersist` calling `saveLayout(..., true)`)
- Keep immediate save for template load (already done)
- No change to save timing — current behavior is correct

### Migration edge cases
- Corrupt/unparseable layouts: keep existing `catch { /* keep defaults */ }` pattern — silently fall back to defaults
- Missing widget IDs in saved layout: already handled by the merged-order loop (lines 416-424)
- Mixed old/new accounts: each account layout migrates independently on load via `_gridScale` check
- Templates with `sizes` (string format): upscale using same mapping: large/normal=12, medium=8, compact=4

### Claude's Discretion
- Whether to extract migration logic into a shared helper function vs inline duplication
- Error toast on save failure (currently silent) — add if trivial, skip if complex
- Whether to stamp `_gridScale` on user-saved templates when saving new ones

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `saveLayout()` (DashboardShell.tsx:521): Already saves `{w, h}` dims with `_gridScale` marker to settings API
- Layout load migration (DashboardShell.tsx:426-449): Handles string sizes, 6-col dims, 12-col dims, and 24-col dims
- Admin template migration (DashboardShell.tsx:461-483): Same upscaling logic for `admin_default_templates`
- `getLayoutKey()` (DashboardShell.tsx:202): Per-account layout key generation

### Established Patterns
- `_gridScale` version marker: Set to `GRID_COLS` (24) to prevent re-migration on reload
- Scale detection heuristic: maxW <= 6 means old 6-col (x4), maxW <= 12 means old 12-col (x2)
- Settings API: PUT `/api/settings` with JSON key-value pairs

### Integration Points
- `dashboard_layout_templates` setting: User-saved templates stored as JSON array — needs migration on template load
- `admin_default_templates` setting: Admin overrides — already has migration
- `handleLoadTemplate` (DashboardShell.tsx:568): Entry point where template migration should be applied
- `handleSaveTemplate` (DashboardShell.tsx:549): Should stamp `_gridScale` when saving new templates

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user deferred all decisions to Claude's discretion. Apply the same migration patterns already established in Phase 27 for layout loading.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-layout-persistence-and-migration*
*Context gathered: 2026-03-22*
