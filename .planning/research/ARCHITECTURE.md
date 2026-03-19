# Architecture Patterns

**Domain:** Settings overhaul, email URL auto-detection, dashboard layout templates, per-trade checklists
**Researched:** 2026-03-19
**Milestone:** v2.1 Settings & Polish
**Confidence:** HIGH (derived from full codebase read; all patterns proven from existing code)

---

## Executive Context

This milestone adds no new pages and no new database tables beyond a single new settings key
(`dashboard_layout_templates`). Every feature integrates into existing extension points:
`app/settings/page.tsx` (component split), `lib/email.ts` (URL detection), `dashboard_layout`
settings key (templates), and the `checklist_items`/`strategy_id` trade columns (per-trade
checklist editing). The constraint is clean integration without structural rewrites.

---

## Recommended Architecture

```
app/
  settings/page.tsx                  MODIFY: thin shell only — imports section components,
                                             switches to full-width layout
components/
  settings/                          NEW: extracted section components
    AccountSection.tsx
    AccountsSection.tsx
    TagsSection.tsx
    TemplatesSection.tsx
    DisplaySection.tsx
    ChartSection.tsx
    StrategiesSection.tsx
    IntegrationsSection.tsx
    BrokerSection.tsx
    SecuritySection.tsx
    DataSection.tsx
    AdminUsersSection.tsx
    AdminSystemSection.tsx
lib/
  email.ts                           MODIFY: getAppUrl() reads request headers before DB fallback
  request-url.ts                     NEW: getRequestBaseUrl(req) helper — single source of truth
app/
  api/
    settings/
      route.ts                       UNMODIFIED
    admin/
      settings/
        route.ts                     MODIFY: add api_keys (fmp_api_key, openai_api_key, ibkr_*) to SYSTEM_KEYS
        detect-url/route.ts          NEW: GET endpoint → returns detected base URL from request
    dashboard/
      templates/route.ts             NEW: GET/POST/DELETE for named layout templates
components/
  TradeModal.tsx                     MODIFY: checklist editor inline when strategy has items
  dashboard/
    DashboardShell.tsx               MODIFY: template save/load/apply UI in edit mode header
```

---

## Component Boundaries

### Feature 1: Settings Page Component Split

The monolith at `app/settings/page.tsx` (~2380 lines) has a single `SettingsContent` function
containing all state and all rendering. Every tab's state lives together, causing 30+ useState
declarations at the top and conditional rendering via `{activeCategory === "x" && <section>}`.

**What to split:**

Each of the 13 categories (defined in the `CATEGORIES` array) becomes its own component under
`components/settings/`. The shell (`app/settings/page.tsx`) retains:
- The `CATEGORIES` constant and tab navigation rendering
- The `isAdmin`/`hasAdmin` state (needed to show/hide admin tabs)
- The `activeCategory` state and switcher

Each section component is responsible for:
- Its own data fetching (currently inlined in one giant `useEffect`)
- Its own local state (currently 30+ mixed useState calls)
- Its own save handler
- Its own rendering

**Shared state problem:** Several pieces of state span categories:
- `settings` object: currently one large state shared across all tabs
- `isAdmin`: needed by the shell for tab visibility

**Resolution:** Pass `isAdmin` down from the shell as a prop. Each section component calls
`/api/settings` itself on mount (GET) and on save (PUT). This is acceptable because settings
fetches are already cheap (single SQLite read) and section-level data isolation is worth the
minor duplication. Do not introduce a React Context for settings — it is overkill for this scope.

**Layout change (full-width):**

Current layout (`app/settings/page.tsx` line 677):
```tsx
<div className="flex gap-6">
  <nav className="hidden sm:flex flex-col w-48 shrink-0 sticky top-20 ...">
  <div className="flex-1 min-w-0 space-y-6 sm:max-w-2xl min-h-[80vh]">
```

New layout (remove `sm:max-w-2xl`, expand content area):
```tsx
<div className="flex gap-6">
  <nav className="hidden sm:flex flex-col w-52 shrink-0 sticky top-20 ...">
  <div className="flex-1 min-w-0 space-y-6 min-h-[80vh]">
```

The `sm:max-w-2xl` constraint is the only change needed for full-width. The sidebar nav stays
fixed-width. This affects all 13 sections — some (like Strategies with drag/drop) benefit from
the extra width; others (like Account with 3-column grid) already handle it gracefully.

**Component interface pattern:**

```typescript
// components/settings/AccountSection.tsx
interface AccountSectionProps {
  isAdmin: boolean;
}

export default function AccountSection({ isAdmin }: AccountSectionProps) {
  const [settings, setSettings] = useState({ account_size: "10000", risk_per_trade: "1", ... });

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      setSettings(s => ({ ...s, ...data }));
    });
  }, []);

  const save = async () => { ... };

  return <section>...</section>;
}
```

**SortableStrategy is already extracted** (lines 110-194 in settings/page.tsx) — keep as-is,
just move it into `components/settings/StrategiesSection.tsx`.

**AdminSystemSection** is the highest-priority split: the admin system section currently
duplicates functionality from `app/admin/settings/page.tsx`. After split, the settings page
section and the standalone admin page should share the same data model and API. The standalone
`/admin/settings` page can remain or be deprecated — document the decision.

| Component | Communicates With | Notes |
|-----------|------------------|-------|
| `app/settings/page.tsx` (shell) | All section components via props | Retains nav + isAdmin only |
| `components/settings/*Section.tsx` (×13) | `/api/settings` GET+PUT, `/api/admin/*` (admin sections only) | Each self-contained |
| `components/settings/AdminSystemSection.tsx` | `/api/admin/settings` GET+POST | Same API as existing admin panel |
| `components/settings/BrokerSection.tsx` | `/api/broker/ibkr/*`, `/api/settings` | No change to broker API routes |

---

### Feature 2: Email URL Auto-Detection

**Current state (`lib/email.ts` — `getAppUrl()`):**
```typescript
function getAppUrl(): string {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'app_url'").get();
    if (row?.value) return row.value;
  } catch {}
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
```

This function has no access to the incoming HTTP request, so it cannot read `Host` or
`X-Forwarded-*` headers. `getAppUrl()` is called from `sendVerificationEmail`,
`sendPasswordResetEmail`, `sendOtpEmail`, and `sendAlertEmail` — all server-side, triggered
from API route handlers that DO have the request object.

**Solution: pass the request to callers, add a new helper:**

```typescript
// lib/request-url.ts  (NEW)
import { NextRequest } from "next/server";

/**
 * Derives the public base URL from the incoming request's headers.
 * Priority: DB app_url → X-Forwarded-Proto+Host → Host header → env → localhost.
 * Call this from API route handlers; pass the result to email functions.
 */
export function getRequestBaseUrl(req: NextRequest): string {
  // 1. Admin-configured URL takes highest precedence (explicit beats inferred)
  try {
    const { getDb } = require("./db");
    const db = getDb();
    const row = db.prepare(
      "SELECT value FROM settings WHERE user_id = '_system' AND key = 'app_url'"
    ).get() as { value: string } | undefined;
    if (row?.value) return row.value.replace(/\/$/, "");
  } catch {}

  // 2. Reverse proxy headers (Docker, Cloudflare Tunnel, nginx)
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;

  // 3. Env var fallback
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // 4. localhost default
  return "http://localhost:3000";
}
```

**Caller change pattern (auth API routes):**

```typescript
// app/api/auth/register/route.ts (and similar)
export async function POST(req: NextRequest) {
  // ... existing logic ...
  const baseUrl = getRequestBaseUrl(req);
  await sendVerificationEmail(user.email, user.name, token, baseUrl);
}
```

**Email function signature change:**

```typescript
// lib/email.ts
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
  baseUrl?: string          // NEW optional param; falls back to getAppUrl()
): Promise<void> {
  const url = `${baseUrl ?? getAppUrl()}/api/auth/verify-email?token=${token}`;
  ...
}
```

Making `baseUrl` optional maintains backward compatibility. The existing `getAppUrl()` remains
for cases where no request is available (background jobs, if any).

**Callers to update:**

| File | Function | Change |
|------|----------|--------|
| `app/api/auth/register/route.ts` | POST | Pass `getRequestBaseUrl(req)` to `sendVerificationEmail` |
| `app/api/auth/login/route.ts` | POST (OTP path) | Pass to `sendOtpEmail` |
| `app/api/auth/forgot-password/route.ts` | POST | Pass to `sendPasswordResetEmail` |
| `app/api/alerts/route.ts` (if exists) | Alert trigger | Pass to `sendAlertEmail` |
| `lib/email.ts` | `sendVerificationEmail`, `sendOtpEmail`, `sendPasswordResetEmail`, `sendAlertEmail` | Add optional `baseUrl` param |

**Detection logic rationale:**

- `x-forwarded-proto` + `x-forwarded-host`: set by nginx, Traefik, Cloudflare Tunnel. Most
  reliable for Docker/reverse-proxy setups.
- `host` header: always present in direct HTTP/HTTPS. Sufficient for `npm run start` on custom
  port or domain without a proxy.
- DB `app_url` remains the override for cases where inference fails (self-signed certs, split
  DNS, etc.).

**No new API endpoint needed.** The `detect-url` route listed in the recommended architecture
is optional: it provides a UI button in AdminSystemSection to auto-fill the app_url field by
echoing back the detected URL. Implement if the UX warrants it:

```typescript
// app/api/admin/settings/detect-url/route.ts  (OPTIONAL)
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ url: getRequestBaseUrl(req) });
}
```

---

### Feature 3: Dashboard Layout Templates

**Current state:** `dashboard_layout` is a single JSON string stored in settings:
```typescript
interface DashboardLayout {
  order: string[];
  hidden: string[];
  sizes: Record<string, WidgetSize>;
}
```

Loaded from settings on mount, saved via debounced `PUT /api/settings` on any edit-mode change.
There are no templates — only the live layout.

**Proposed data model:**

Add a new settings key `dashboard_layout_templates` (stored in settings table, user-scoped):

```typescript
interface DashboardLayoutTemplate {
  id: string;         // crypto.randomUUID()
  name: string;       // user-defined label
  layout: DashboardLayout;
  created_at: string; // ISO timestamp
}
// stored as: JSON.stringify(DashboardLayoutTemplate[])
```

No new database table needed. This follows the existing pattern for `strategies`, `trade_templates`,
and `watchlists` — all stored as JSON strings in the settings table.

**DashboardShell changes:**

```typescript
// components/dashboard/DashboardShell.tsx
const [templates, setTemplates] = useState<DashboardLayoutTemplate[]>([]);

// Load alongside dashboard_layout in the existing settings fetch:
useEffect(() => {
  fetch("/api/settings").then(r => r.json()).then(data => {
    // existing dashboard_layout load...
    if (data.dashboard_layout_templates) {
      try { setTemplates(JSON.parse(data.dashboard_layout_templates)); } catch {}
    }
  });
}, []);

// Save templates:
const saveTemplates = (newTemplates: DashboardLayoutTemplate[]) => {
  setTemplates(newTemplates);
  fetch("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(newTemplates) }),
  });
};

// Save current layout as template:
const saveAsTemplate = (name: string) => {
  const newTemplate: DashboardLayoutTemplate = {
    id: crypto.randomUUID(),
    name,
    layout: { ...layout },
    created_at: new Date().toISOString(),
  };
  saveTemplates([...templates, newTemplate]);
};

// Apply template:
const applyTemplate = (template: DashboardLayoutTemplate) => {
  setLayout(template.layout);
  // triggers existing debounced save of dashboard_layout
};

// Delete template:
const deleteTemplate = (id: string) => {
  saveTemplates(templates.filter(t => t.id !== id));
};
```

**UI placement:** Template controls appear in the edit mode header bar (alongside the existing
"Done", privacy toggle, and time filter). When `editMode === true`, add a "Templates" dropdown:
- "Save current as template..." → input for name → `saveAsTemplate(name)`
- Divider
- List of saved templates → click to apply → `applyTemplate(template)`
- Delete button per template

This is entirely self-contained within `DashboardShell.tsx`. No new API route is needed since
`/api/settings` PUT already handles arbitrary keys.

**No API route needed.** The `app/api/dashboard/templates/route.ts` listed in the recommended
architecture diagram is marked as NEW but in practice is not needed — settings PUT covers it.
Skip the dedicated route.

---

### Feature 4: Per-Trade Checklist Editing

**Current state:**

The `Trade` interface already has:
```typescript
strategy_id?: string | null;     // references a strategy by ID
checklist_items?: string | null;  // JSON: Record<string, boolean> — checked state
wyckoff_checklist?: string | null; // legacy field (pre-strategy system)
```

Trades table already has both columns (migration 016 added `strategy_id`, migration 017 added
`checklist_items`).

The existing `TradeModal.tsx` reads strategies from `/api/settings`, renders the strategy
selector, and saves `strategy_id` and `checklist_items` on the trade. What is NOT implemented:
inline editing of the checklist items themselves (adding/removing items for this specific trade).

**Three new behaviors for v2.1:**

1. **Built-in strategy defaults** — When `strategies` setting is empty, populate with the 5
   Wyckoff/Momentum defaults that already exist in `TradeModal.tsx` as `DEFAULT_STRATEGIES`.
   This is already partially done (line 98 in TradeModal: `setStrategies(DEFAULT_STRATEGIES)`
   when settings strategies is empty). No architecture change — just ensure settings page
   also seeds defaults when strategies is blank.

2. **Per-trade checklist item editing** — When a trade has a strategy selected, allow the user
   to add/remove/edit individual checklist items for that specific trade (overriding the strategy
   template). Store the edited items in `checklist_items` as a structured JSON:

   ```typescript
   // Current format (unknown from codebase — likely Record<string, boolean>)
   // Proposed extended format:
   interface TradeChecklist {
     items: Array<{ text: string; checked: boolean }>;
     customized: boolean; // true if user has edited items (vs. used strategy template)
   }
   ```

   This is a format change for `checklist_items`. Since the column exists and stores JSON, the
   change is backward-compatible (old data: `{ "Item text": true }` → new data: `{ items: [...], customized: true }`).
   A migration is NOT needed — the column exists. Handle both formats in the reader:

   ```typescript
   function parseChecklistItems(raw: string | null): TradeChecklist {
     if (!raw) return { items: [], customized: false };
     try {
       const parsed = JSON.parse(raw);
       // New format
       if (parsed.items && Array.isArray(parsed.items)) return parsed;
       // Old format: Record<string, boolean>
       return {
         items: Object.entries(parsed).map(([text, checked]) => ({ text, checked: Boolean(checked) })),
         customized: false,
       };
     } catch { return { items: [], customized: false }; }
   }
   ```

3. **Ad-hoc checklists** — Allow creating a checklist on a trade that has no strategy selected.
   Same `checklist_items` field, same `TradeChecklist` format, `strategy_id = null`.

**TradeModal changes:**

The setup tab currently renders a strategy selector and a read-only checklist view. Add:
- An "Edit checklist" toggle button (pencil icon) when a strategy is selected
- When editing: each item gets an input field + delete button; an "Add item" button at bottom
- A "Reset to strategy defaults" button to revert customization
- When no strategy: a "+ Add checklist" button to create ad-hoc items

All state is local to TradeModal — write to `form.checklist_items` via `set("checklist_items", ...)`.
No new API calls — saved when the trade is saved via existing `PUT /api/trades/:id`.

**Integration with strategy settings:** The strategies settings tab already edits the template
checklists. Per-trade editing is strictly a TradeModal concern. The two features do not
need to communicate beyond the initial load of the strategy template.

---

### Feature 5: Admin Panel as Config Source (API Keys)

**Current state:** `SYSTEM_KEYS` in `app/api/admin/settings/route.ts` is:
```typescript
const SYSTEM_KEYS = [
  "account_size", "risk_per_trade",
  "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from",
  "app_url",
];
```

API keys (`fmp_api_key`, `openai_api_key`, `ibkr_host`, `ibkr_port`, `ibkr_client_id`) are
currently user-scoped settings, not system settings. For a single-user instance, having the
admin control these is more intuitive.

**Decision:** Keep API keys user-scoped. Rationale: a multi-user instance might have different
users with different API keys. The admin panel controlling user-scoped settings silently
overwrites per-user preferences. Better approach: admin panel manages system-level config
(SMTP, app_url, registration settings); user settings manage API keys. The "admin as single
source of truth" goal is met by ensuring SMTP and app_url are only configurable from the admin
panel (not duplicated in the user settings integrations tab).

**Change needed:** Remove SMTP fields from the user-facing Integrations tab in settings.
Currently `app/settings/page.tsx` admin-settings section shows SMTP, but the Integrations tab
does not — this is already correct. Ensure `AdminSystemSection` is the only place SMTP is shown.

**SYSTEM_KEYS expansion** (if desired for API keys as system defaults):
```typescript
// app/api/admin/settings/route.ts
const SYSTEM_KEYS = [
  "account_size", "risk_per_trade",
  "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from",
  "app_url",
  // Add if admin should control defaults:
  // "fmp_api_key", "openai_api_key"
];
```

The settings API already implements `_system` fallback for user settings (via the COALESCE
query in `GET /api/settings`). If `fmp_api_key` is stored at `_system`, it becomes the default
for all users who haven't set their own. This is the right pattern if API keys are shared.

---

## Data Flow Changes (System-Wide)

### New Settings Keys

| Key | Scope | Format | Purpose |
|-----|-------|--------|---------|
| `dashboard_layout_templates` | user | `JSON: DashboardLayoutTemplate[]` | Named layout presets |

No new database columns. No new tables. Next migration would be 022 if a schema change were needed — none required for this milestone.

### Modified Function Signatures

| Function | File | Change |
|----------|------|--------|
| `sendVerificationEmail` | `lib/email.ts` | Add optional `baseUrl?: string` param |
| `sendOtpEmail` | `lib/email.ts` | Add optional `baseUrl?: string` param |
| `sendPasswordResetEmail` | `lib/email.ts` | Add optional `baseUrl?: string` param |
| `sendAlertEmail` | `lib/email.ts` | Add optional `baseUrl?: string` param |
| `getAppUrl` | `lib/email.ts` | Keep as-is (fallback for callers without request) |

### New Files

| File | Type | Purpose |
|------|------|---------|
| `lib/request-url.ts` | NEW lib | `getRequestBaseUrl(req)` — request-aware URL detection |
| `components/settings/AccountSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/AccountsSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/TagsSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/TemplatesSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/DisplaySection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/ChartSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/StrategiesSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/IntegrationsSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/BrokerSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/SecuritySection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/DataSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/AdminUsersSection.tsx` | NEW component | Extracted from settings monolith |
| `components/settings/AdminSystemSection.tsx` | NEW component | Extracted from settings monolith |

### Modified Files

| File | Change Type | What Changes |
|------|-------------|--------------|
| `app/settings/page.tsx` | MODIFY (major) | Reduce to shell: nav + isAdmin + section routing |
| `lib/email.ts` | MODIFY | `sendX()` functions accept optional `baseUrl`; no structural change |
| `lib/request-url.ts` | NEW | `getRequestBaseUrl(req)` helper |
| `app/api/auth/register/route.ts` | MODIFY | Pass `getRequestBaseUrl(req)` to email sender |
| `app/api/auth/login/route.ts` | MODIFY | Pass `getRequestBaseUrl(req)` to email sender (OTP path) |
| `app/api/auth/forgot-password/route.ts` | MODIFY | Pass `getRequestBaseUrl(req)` to email sender |
| `components/dashboard/DashboardShell.tsx` | MODIFY | Add template state + UI in edit mode header |
| `components/TradeModal.tsx` | MODIFY | Add inline checklist editing, ad-hoc checklist creation |
| `app/api/admin/settings/route.ts` | MODIFY (optional) | Expand SYSTEM_KEYS if admin controls API keys |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared State Object Across Settings Sections
**What:** Keeping one large `settings` state object that all 13 section components read and write.
**Why bad:** Every keypress in any section triggers re-renders across all sections (even hidden ones). When split into components, shared state requires either prop drilling through the shell or a Context — both add complexity that defeats the purpose of splitting.
**Instead:** Each section component owns its own state, fetches settings on mount, saves on its own schedule. Slight redundancy (13 settings fetches on tab switch) is acceptable — settings API is a fast SQLite read returning ~2KB.

### Anti-Pattern 2: `getAppUrl()` Without Request Context
**What:** Continuing to call `getAppUrl()` from API route handlers that have a `req` object available.
**Why bad:** The DB `app_url` field is often empty. Falling through to `NEXT_PUBLIC_APP_URL` or `localhost:3000` breaks email links in Docker/tunnel deployments where the public URL was never explicitly configured.
**Instead:** API route handlers call `getRequestBaseUrl(req)` and pass the result to email functions. `getAppUrl()` remains only as the no-request fallback.

### Anti-Pattern 3: New Database Table for Layout Templates
**What:** Creating a `dashboard_templates` table with its own CRUD API.
**Why bad:** The existing `strategies` feature stores 5 complex objects as JSON in one settings row with no issues. Templates are smaller and simpler. A dedicated table adds migration complexity, a new API route, and TypeScript types for no benefit at current scale (solo trader, < 20 templates).
**Instead:** `dashboard_layout_templates` key in the settings table, same pattern as `strategies`.

### Anti-Pattern 4: Prompt User to Set app_url Before Request-Based Auto-Detection
**What:** Blocking email sends or showing an error if `app_url` is not configured.
**Why bad:** The whole point of request-header detection is to make it work without configuration. If detection works correctly, `app_url` only needs to be set in edge cases (custom domain without proper headers).
**Instead:** Detect first, show detected URL in admin UI as read-only "Current detected URL", allow override via `app_url` setting. Never block email sends.

### Anti-Pattern 5: Deep Copy of Strategy Checklist on Per-Trade Edit
**What:** On trade save, embedding the full strategy checklist text into `checklist_items` even when unchanged.
**Why bad:** If the strategy template is later edited, existing trades silently retain the old checklist text. Harder to tell which trades used the original vs. customized checklist.
**Instead:** When `customized: false`, store only checked states keyed by position (or empty). When `customized: true`, store the full item text. This lets TradeModal merge strategy template (current) + checked state (saved) for uncustomized trades, and use the stored text for customized ones.

---

## Build Order (Feature Dependencies)

The four features have no cross-dependencies. Any order is valid, but this sequence minimizes
risk and delivers value incrementally:

### 1. Email URL Auto-Detection (lowest risk, highest deployment value)
No UI changes. Server-only. Verifiable immediately in any deployment with email enabled.
1. Create `lib/request-url.ts` with `getRequestBaseUrl(req)`
2. Update email function signatures in `lib/email.ts` (optional `baseUrl` param)
3. Update auth API route callers (`register`, `login` OTP, `forgot-password`)
4. (Optional) Add `GET /api/admin/settings/detect-url` for UI preview

### 2. Settings Page Component Split (high complexity, foundational for tab reorganization)
Split before touching individual section content — changes to layout or tab structure during
the split would cause merge conflicts if done simultaneously.
1. Create `components/settings/` directory
2. Extract sections one at a time (start with simplest: `AccountSection`, `DisplaySection`)
3. Reduce `app/settings/page.tsx` to shell after all sections extracted
4. Apply full-width layout change (remove `sm:max-w-2xl`)
5. Tab reorganization (rename, reorder, consolidate any tabs per UX decision)

### 3. Dashboard Layout Templates (medium complexity, contained in DashboardShell)
Self-contained. No auth changes, no email changes, no settings extraction dependency.
1. Define `DashboardLayoutTemplate` interface in `lib/types.ts`
2. Add template state + load logic to `DashboardShell.tsx`
3. Add template save/apply/delete functions
4. Add template UI to edit mode header

### 4. Per-Trade Checklist Editing (medium complexity, TradeModal only)
Depends on nothing new. Modifies existing checklist rendering in TradeModal.
1. Define `TradeChecklist` interface, write `parseChecklistItems` helper
2. Add edit mode toggle to checklist section in TradeModal setup tab
3. Implement inline add/edit/remove item UI
4. Add "Reset to strategy defaults" button
5. Add "Ad-hoc checklist" flow when no strategy selected

---

## Patterns to Follow

### Pattern 1: Section Component with Self-Contained Fetch
Each settings section owns its data lifecycle:
```typescript
// components/settings/StrategiesSection.tsx
export default function StrategiesSection() {
  const [strategies, setStrategies] = useState<TradeStrategy[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data.strategies) {
          try { setStrategies(JSON.parse(data.strategies)); } catch {}
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategies: JSON.stringify(strategies) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return <section>...</section>;
}
```

### Pattern 2: Request-Aware URL in API Routes
```typescript
// app/api/auth/register/route.ts
import { getRequestBaseUrl } from "@/lib/request-url";

export async function POST(req: NextRequest) {
  // ... create user, token ...
  const baseUrl = getRequestBaseUrl(req);
  await sendVerificationEmail(user.email, user.name, token, baseUrl);
  // ...
}
```

### Pattern 3: JSON-in-Settings for Simple Collections
Template list follows the strategies pattern exactly:
```typescript
// In DashboardShell.tsx saveTemplates():
await fetch("/api/settings", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    dashboard_layout_templates: JSON.stringify(newTemplates),
  }),
});
```

### Pattern 4: Backward-Compatible JSON Field Evolution
When extending an existing JSON-encoded trade field:
```typescript
function parseChecklistItems(raw: string | null): TradeChecklist {
  if (!raw) return { items: [], customized: false };
  try {
    const parsed = JSON.parse(raw);
    if (parsed.items && Array.isArray(parsed.items)) return parsed as TradeChecklist;
    // Legacy: Record<string, boolean>
    return {
      items: Object.entries(parsed as Record<string, boolean>).map(([text, checked]) => ({ text, checked })),
      customized: false,
    };
  } catch {
    return { items: [], customized: false };
  }
}
```

---

## Integration Touchpoints Summary

| Feature | Files Modified | Files Created |
|---------|---------------|---------------|
| Email URL detection | `lib/email.ts`, `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/forgot-password/route.ts` | `lib/request-url.ts` |
| Settings split | `app/settings/page.tsx` | `components/settings/*Section.tsx` (×13) |
| Layout templates | `components/dashboard/DashboardShell.tsx`, `lib/types.ts` | None |
| Per-trade checklists | `components/TradeModal.tsx` | None |
| Admin as config source | `app/api/admin/settings/route.ts` (SYSTEM_KEYS expansion) | None |

**Untouched:** `lib/db.ts` (no migrations needed), `middleware.ts`, `lib/auth.ts`,
`app/api/settings/route.ts`, all broker API routes, all trade API routes.

---

## Scalability Considerations

These remain single-user SQLite applications. The relevant concerns for this milestone:

| Concern | Assessment |
|---------|------------|
| 13 settings fetches on tab switches | Each is a single SQLite row scan returning ~2KB. Negligible. No caching needed. |
| Layout template storage as JSON string | Reasonable for < 50 templates. At ~500 bytes per template, 50 templates = 25KB. Fits comfortably in settings row. |
| `x-forwarded-host` header trust | Next.js does not validate trusted proxies. In Docker/Cloudflare Tunnel this is fine. In public internet deployments, validate that `x-forwarded-host` is not spoofable (add to production checklist). |
| checklist_items JSON format migration | No data migration needed — format change is backward-compatible via the `parseChecklistItems` reader. |

---

## Sources

- Existing codebase: `app/settings/page.tsx` (2380 lines, read in full sections)
- Existing codebase: `lib/email.ts`, `lib/types.ts`, `lib/db.ts` (read in full)
- Existing codebase: `app/api/settings/route.ts`, `app/api/admin/settings/route.ts` (read in full)
- Existing codebase: `components/dashboard/DashboardShell.tsx` (read lines 1-430)
- Existing codebase: `components/TradeModal.tsx` (read lines 1-200)
- Next.js 15 App Router request headers: `req.headers.get()` is the standard pattern (HIGH confidence — established API)
- `x-forwarded-proto` / `x-forwarded-host` header conventions: standard reverse proxy behavior (HIGH confidence — RFC 7239, widely implemented)
- Confidence: HIGH — all patterns derived directly from existing codebase; no external dependencies introduced
