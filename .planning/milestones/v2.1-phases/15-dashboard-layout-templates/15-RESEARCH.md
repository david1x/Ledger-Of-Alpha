# Phase 15: Dashboard Layout Templates - Research

**Researched:** 2026-03-20
**Domain:** React state management, settings persistence, UI patterns for named configuration management
**Confidence:** HIGH

## Summary

This phase adds save/load/delete operations for named dashboard layout templates on top of the existing `DashboardLayout` interface (`{ order, hidden, sizes }`). All the primitives are already in place: the `DashboardLayout` type, `DEFAULT_ORDER`/`DEFAULT_HIDDEN`/`DEFAULT_SIZES` constants, `saveLayout()` / `resetLayout()` functions, and the `/api/settings` key-value store. The work is primarily UI — wiring template CRUD operations into the edit mode toolbar and managing two new storage keys.

The most architecturally interesting decision is the split scope: the **template library** is global (one `dashboard_layout_templates` settings key, shared across all accounts), while the **active layout** is per-account (separate settings keys keyed by account ID). This requires a storage key derivation pattern and a load strategy that checks account-specific keys before falling back to the default `dashboard_layout` key.

Built-in presets are hardcoded constants (not stored in the DB) and must be merged at read time with user-created templates. They are read-only from the user's perspective; the "Save as..." flow creates a copy in the user's template library.

**Primary recommendation:** Implement in two sequential waves — (1) per-account active layout storage refactor + preset constants, then (2) template library UI with save/load/delete toolbar controls.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 2 built-in presets: **Performance Review** and **Daily Monitor**
- Performance Review: all analytics widgets visible (charts, tables, stats) — full deep-dive layout
- Daily Monitor: compact morning check-in — today's P&L, market gauges (fear/greed, VIX, market overview), heatmap, and quick stats
- Built-in presets are **read-only** — users cannot overwrite or delete them
- Users can duplicate a built-in preset to create their own editable copy ("Save as...")
- The existing Reset button continues to restore `DEFAULT_ORDER` — it is NOT replaced by a preset
- Template **library is global** (user-level) — all templates appear regardless of active account
- **Active layout is per-account** — each account tracks its own currently applied layout independently
- "All Accounts" view (activeAccountId = null) has its own layout state, treated like its own account
- Templates store **widget layout only** (order, hidden, sizes) — time filter is NOT included

### Claude's Discretion
- Template UI placement and controls design (dropdown, modal, inline panel)
- Save/load workflow details (naming prompt, confirmation step, overwrite behavior)
- Storage key structure for per-account active layouts
- Exact widget selection and sizing for each built-in preset

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can save current dashboard layout as a named template | Template library stored as `dashboard_layout_templates` JSON in settings; save action captures current `layout` state with a user-provided name |
| DASH-02 | User can load a saved template to replace active layout | Load calls `saveLayout()` with the template's `DashboardLayout` data; confirmation step via inline confirm or browser confirm(); per-account active layout storage must be resolved first |
| DASH-03 | User can delete saved templates | Filter template library array, PUT updated list back to `/api/settings`; built-in presets must be filtered out client-side |
| DASH-04 | 2-3 built-in preset templates ship with the app | Hardcoded `BUILT_IN_TEMPLATES` constant in `DashboardShell.tsx`; merged at render time with user templates — never stored in DB |
| DASH-05 | Template controls accessible from dashboard edit mode toolbar | Add template dropdown/panel to the existing pill-shaped edit mode toolbar (lines 947-999 of DashboardShell.tsx) |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useState/useRef/useCallback | 18.x | Local state for template list, name input, open/close UI | Already used throughout DashboardShell |
| `/api/settings` PUT | existing | Persist template library as JSON string | Established pattern for all dashboard persistence |
| lucide-react | existing | Icons (BookmarkPlus, BookOpen, Trash2, Copy) | Project icon standard |
| Tailwind CSS v3 | existing | Styling the template panel/dropdown | Project styling standard |

### No New Dependencies
This phase requires zero new npm packages. All required primitives (storage, UI, state) exist in the codebase.

**Installation:**
```bash
# Nothing to install
```

---

## Architecture Patterns

### Recommended Data Shapes

#### Template Library (stored in settings key `dashboard_layout_templates`)
```typescript
// Source: derived from existing DashboardLayout interface in DashboardShell.tsx
interface LayoutTemplate {
  id: string;          // nanoid or Date.now().toString() — unique, stable
  name: string;        // user-provided display name
  layout: DashboardLayout;  // { order, hidden, sizes }
  createdAt: string;   // ISO date string
}

type TemplateLibrary = LayoutTemplate[];
```

#### Built-in Presets (hardcoded constant, NOT stored in DB)
```typescript
// Source: project pattern from DEFAULT_ORDER / DEFAULT_HIDDEN / DEFAULT_SIZES
const BUILT_IN_TEMPLATES: (Omit<LayoutTemplate, 'createdAt'> & { readonly: true })[] = [
  {
    id: '__preset_performance_review',
    name: 'Performance Review',
    readonly: true,
    layout: {
      order: [...], // All analytics widgets
      hidden: [],   // Nothing hidden
      sizes: {...}, // Full-size charts
    }
  },
  {
    id: '__preset_daily_monitor',
    name: 'Daily Monitor',
    readonly: true,
    layout: {
      order: ['daily-loss-status', 'fear-greed', 'vix', 'market-overview', 'heatmap', 'total-return', 'total-trades', 'profit-factor'],
      hidden: [...], // Everything else hidden
      sizes: { /* all compact */ },
    }
  },
];
```

#### Per-Account Active Layout Storage Key
```typescript
// Derive storage key from activeAccountId
// null = "All Accounts" treated as its own account slot
function getLayoutKey(activeAccountId: string | null): string {
  return activeAccountId
    ? `dashboard_layout_${activeAccountId}`
    : 'dashboard_layout_all_accounts';
}
// NOTE: The existing 'dashboard_layout' key remains as a migration fallback only.
// On first load, if account-specific key is absent, fall back to 'dashboard_layout'.
```

### Recommended Project Structure (no new files required)
All changes live in `DashboardShell.tsx` with the addition of one small sub-component for the template panel:

```
components/dashboard/
├── DashboardShell.tsx        # Primary change file — add template state + handlers
└── TemplatePanel.tsx         # New: extracted template UI (dropdown/panel component)
```

Extracting `TemplatePanel.tsx` is optional but recommended to keep `DashboardShell.tsx` from growing further. It receives `templates`, `builtIns`, `onSave`, `onLoad`, `onDelete`, `onSaveAs` as props.

### Pattern 1: Template Save Flow
**What:** Capture current layout state, prompt for name, add to library, persist.
**When to use:** User clicks "Save Template" button in edit mode toolbar.

```typescript
// Source: extended from existing saveLayout() pattern in DashboardShell.tsx ~line 417
const handleSaveTemplate = useCallback((name: string) => {
  const newTemplate: LayoutTemplate = {
    id: String(Date.now()),
    name: name.trim(),
    layout: { ...layout },
    createdAt: new Date().toISOString(),
  };
  const updated = [...templates, newTemplate];
  setTemplates(updated);
  if (me && !me.guest) {
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(updated) }),
    });
  }
}, [layout, templates, me]);
```

### Pattern 2: Per-Account Layout Load/Save
**What:** Each account reads/writes its own layout key; fallback to legacy `dashboard_layout` on first load.
**When to use:** On initial `load()` call and whenever account switches.

```typescript
// Source: extended from existing load() in DashboardShell.tsx ~line 308
// In the load() function, replace:
//   if (settingsData.dashboard_layout) { ... }
// With:
const layoutKey = getLayoutKey(activeAccountId);
const rawLayout = settingsData[layoutKey] ?? settingsData.dashboard_layout;
if (rawLayout) {
  try {
    const parsed = JSON.parse(rawLayout);
    // ... existing merge + migration logic unchanged ...
    setLayout(parsedLayout);
  } catch { /* keep defaults */ }
}

// In saveLayout(), replace the key used:
body: JSON.stringify({ [getLayoutKey(activeAccountId)]: JSON.stringify(newLayout) }),
```

### Pattern 3: Load Template with Confirmation
**What:** Apply a template's layout to the active account, replacing current layout.
**When to use:** User selects a template from the list.

```typescript
// Source: extended from existing resetLayout() in DashboardShell.tsx ~line 719
const handleLoadTemplate = useCallback((template: LayoutTemplate) => {
  // Show inline confirmation in panel, not browser confirm()
  // On confirm:
  saveLayout({ ...template.layout }, true); // immediate = true to persist right away
}, [saveLayout]);
```

### Pattern 4: Merging Built-ins with User Templates at Render
**What:** Combine hardcoded presets with user templates for display; presets always appear first.

```typescript
// Source: project convention (similar to DEFAULT_ORDER merge logic ~line 362)
const allTemplates = useMemo(() => [
  ...BUILT_IN_TEMPLATES,
  ...templates,
], [templates]);
```

### Anti-Patterns to Avoid
- **Storing built-in presets in the DB:** Presets would need migration every time widgets are added. Keep them as code constants.
- **Overwriting `dashboard_layout` key for per-account storage:** The old key is a migration source. Write to `dashboard_layout_${accountId}` and `dashboard_layout_all_accounts` instead. Only read `dashboard_layout` as a fallback.
- **Using `window.confirm()` for load confirmation:** Breaks the project's modal-based UI pattern. Use an inline "Are you sure?" state within the template panel.
- **Loading templates on every re-render:** Load from `settingsData` once in `load()`, store in `useState`. Don't re-fetch on each template operation.
- **Allowing duplicate template names silently:** Either enforce unique names at save time or append a counter suffix — never silently overwrite.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique ID generation | Custom UUID logic | `String(Date.now())` or `crypto.randomUUID()` | Date.now() is sufficient for single-user templates; no collision risk |
| Template persistence | New API route | Existing `/api/settings` PUT | Already handles JSON string values; no schema change needed |
| Name validation | Complex form library | Simple `.trim().length > 0` guard | Single text input, no complex validation needed |
| Confirmation dialog | New AlertModal | Inline confirm state in TemplatePanel | Simpler than modal for a two-button confirm flow |

**Key insight:** The existing settings key-value store handles arbitrary JSON blobs with no size limit concern for a single user's template library (dozens of templates at most).

---

## Common Pitfalls

### Pitfall 1: Account Switch Loses Per-Account Layout
**What goes wrong:** User switches account, `load()` is re-called (via `useEffect([activeAccountId])`), but if the new per-account key (`dashboard_layout_${id}`) is absent, it falls back to the old global `dashboard_layout`, showing the wrong layout.
**Why it happens:** The `load()` function currently reads `dashboard_layout` unconditionally; the per-account key won't exist on first use.
**How to avoid:** Fallback chain: account-specific key → `dashboard_layout` (legacy) → `DEFAULT_ORDER/HIDDEN/SIZES`. Write to account-specific key immediately on first save after switch.
**Warning signs:** Layout looks identical for all accounts.

### Pitfall 2: Built-in Presets Appear Deletable
**What goes wrong:** The delete button renders for built-in presets, user clicks it, preset disappears from UI (it's filtered from user template array), then reappears on next load (because it's a hardcoded constant). Confusing UX.
**Why it happens:** Rendering delete/overwrite controls without checking `readonly` flag.
**How to avoid:** Check `readonly: true` on template objects; hide delete/rename controls for built-ins. Only show "Save as copy" action.

### Pitfall 3: Template Library Grows Unbounded
**What goes wrong:** No practical issue at single-user scale, but the settings value could theoretically exceed SQLite TEXT limits. Not a real concern given typical usage.
**Why it happens:** N/A for this project.
**How to avoid:** No action needed. The settings TEXT column handles multi-MB values fine.

### Pitfall 4: `saveLayout()` Saves to Wrong Key After Refactor
**What goes wrong:** `saveLayout()` is called from `resetLayout()`, `finishEdit()`, `handleDragEnd()`, `hideWidget()`, `showWidget()`, `toggleSize()`. If `getLayoutKey(activeAccountId)` is computed inside `saveLayout` but `activeAccountId` from `useAccounts()` isn't in the closure, it saves to the wrong key.
**Why it happens:** `activeAccountId` must be included in the `useCallback` dependency array for `saveLayout`.
**How to avoid:** Add `activeAccountId` to `saveLayout`'s `useCallback` dependencies. Since it's already available via `const { accounts, activeAccountId, activeAccount } = useAccounts()`, this is straightforward.
**Warning signs:** Switching account and editing layout corrupts a different account's saved layout.

### Pitfall 5: Template Name Input Dismissed on First Render
**What goes wrong:** Inline name input in the toolbar autofocuses but the toolbar button group uses `overflow-hidden` styling — input gets clipped.
**Why it happens:** The pill-shaped toolbar uses constrained dimensions.
**How to avoid:** Render the save-name input as a small popover or expand the toolbar width when save mode is active. Or render it as a floating panel below the toolbar button.

---

## Code Examples

### Loading Template Library from Settings
```typescript
// Source: extended from existing load() pattern in DashboardShell.tsx ~line 354
if (settingsData.dashboard_layout_templates) {
  try {
    const parsed = JSON.parse(settingsData.dashboard_layout_templates);
    if (Array.isArray(parsed)) setTemplates(parsed);
  } catch { /* keep empty array default */ }
}
```

### Deleting a User Template
```typescript
// Source: project pattern (same as settings persistence pattern)
const handleDeleteTemplate = useCallback((templateId: string) => {
  // Guard: never delete built-ins (they're not in the user array anyway)
  const updated = templates.filter(t => t.id !== templateId);
  setTemplates(updated);
  if (me && !me.guest) {
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(updated) }),
    });
  }
}, [templates, me]);
```

### "Save as Copy" from Built-in Preset
```typescript
// Source: combination of save + copy patterns
const handleSaveAsCopy = useCallback((preset: typeof BUILT_IN_TEMPLATES[0], newName: string) => {
  const copy: LayoutTemplate = {
    id: String(Date.now()),
    name: newName.trim() || `${preset.name} (copy)`,
    layout: { ...preset.layout },
    createdAt: new Date().toISOString(),
  };
  const updated = [...templates, copy];
  setTemplates(updated);
  if (me && !me.guest) {
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(updated) }),
    });
  }
}, [templates, me]);
```

### Edit Mode Toolbar Integration Point
```tsx
// Source: DashboardShell.tsx lines 959-965 (existing editMode conditional block)
{editMode && (
  <>
    <button onClick={resetLayout} ...>
      <RotateCcw ... />
    </button>
    {/* ADD HERE: Template panel trigger button */}
    <TemplateButton
      templates={allTemplates}
      onSave={handleSaveTemplate}
      onLoad={handleLoadTemplate}
      onDelete={handleDeleteTemplate}
      onSaveAs={handleSaveAsCopy}
    />
  </>
)}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Single `dashboard_layout` key (global) | Per-account keys `dashboard_layout_{accountId}` | New for this phase; old key becomes migration fallback |
| No template persistence | `dashboard_layout_templates` JSON array in settings | New for this phase |
| Preset = code default only | Named preset constants merged with user templates | New for this phase |

---

## Open Questions

1. **What widget IDs and sizes define the Performance Review preset?**
   - What we know: "All analytics widgets visible" — likely `hidden: []`, all widgets in `DEFAULT_ORDER`, all at their `DEFAULT_SIZES`
   - What's unclear: Is Performance Review simply the default layout with nothing hidden? Or does it rearrange order to put analytical widgets first?
   - Recommendation: Performance Review = `DEFAULT_ORDER` with `hidden: []` and `DEFAULT_SIZES`. This makes it the "show everything" preset while Reset restores the default visibility. Planner should decide if they differ.

2. **Does applying a template require "Done" confirmation click or apply immediately?**
   - What we know: CONTEXT.md says "confirmation step" is Claude's discretion
   - What's unclear: Inline two-step (click → confirm button appears) vs. immediate apply with undo?
   - Recommendation: Inline two-step — clicking a template name shows a "Apply this layout?" confirm button. No undo needed; user can re-apply their saved templates.

3. **Should `dashboard_layout` (legacy key) be migrated on first save or left as read-only fallback?**
   - What we know: Existing users have their layout in `dashboard_layout`. Post-phase, per-account keys will be used.
   - What's unclear: If we never write to `dashboard_layout` again, it becomes stale but harmless. If we migrate on first load, it creates a one-time write.
   - Recommendation: Migrate-on-first-write — when `saveLayout()` is first called for an account with no account-specific key, read from `dashboard_layout` for initial state (already done in load), then write to `dashboard_layout_{accountId}`. No explicit migration step needed; it's implicit.

---

## Implementation Waves (Recommended)

### Wave 1: Storage Refactor + Preset Constants
- Add `getLayoutKey(activeAccountId)` helper
- Update `load()` to read from account-specific key with `dashboard_layout` fallback
- Update `saveLayout()` to write to account-specific key (add `activeAccountId` to deps)
- Add `BUILT_IN_TEMPLATES` constant with Performance Review and Daily Monitor definitions
- Add `templates` state + load from `dashboard_layout_templates` in `load()`

### Wave 2: Template UI
- Create `TemplatePanel.tsx` (or inline in DashboardShell) — template list with save/load/delete controls
- Add template trigger button to edit mode toolbar
- Wire `handleSaveTemplate`, `handleLoadTemplate`, `handleDeleteTemplate`, `handleSaveAsCopy`
- Guest mode: template controls disabled (matching existing `me && !me.guest` pattern)

---

## Sources

### Primary (HIGH confidence)
- `components/dashboard/DashboardShell.tsx` (full read) — authoritative source for existing types, state patterns, toolbar structure, and saveLayout/resetLayout implementations
- `app/api/settings/route.ts` (full read) — confirms PUT pattern accepts arbitrary JSON string values, no key restrictions
- `lib/account-context.tsx` (full read) — confirms `activeAccountId` (string | null) shape and localStorage persistence pattern
- `15-CONTEXT.md` (full read) — locked decisions and code context provided by user discussion

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — confirmed DASH-01 through DASH-05 scope
- `.planning/STATE.md` — confirmed `dashboard_layout_templates` key name decision from v2.1 research phase

### Tertiary
None — all findings are grounded in direct code inspection of the live codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire phase uses existing codebase primitives; no external library research needed
- Architecture: HIGH — all data shapes derived from existing `DashboardLayout` interface and settings patterns
- Pitfalls: HIGH — identified from direct code inspection (saveLayout closure deps, key fallback chain, built-in guard)

**Research date:** 2026-03-20
**Valid until:** Stable — no third-party dependencies; only invalidated by changes to DashboardShell.tsx or settings API
