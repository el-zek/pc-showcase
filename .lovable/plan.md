# Customers & CRM — Make Submodules Functional

Goal: keep existing CRM hub, colors, and sunset template. Replace every "coming soon" toast with a real, working page. All create/edit uses a top slide-down drawer over the current page.

## Database (migrations)

Extend the existing `customers` table and add CRM-only tables. All with RLS + GRANTs, scoped to `authenticated`.

- `customers`: add `customer_type` (text: retail/wholesale/vip/corporate), `status` (text: active/inactive), `location` (text), `segment_id` (uuid, nullable), `channel_id` (uuid, nullable).
- `customer_segments`: `id, name, description, rule_type (vip|high_value|new|returning|custom), min_spend, min_orders, created_by, timestamps`.
- `marketing_campaigns`: `id, name, description, budget, channel (sms|email|social|whatsapp), start_date, end_date, status, target_segment_id, created_by, timestamps`.
- `customer_channels`: `id, name, type, notes, active, created_by, timestamps`. Seeded with Website, Instagram, Facebook, WhatsApp, Referral, Walk-in, Advertisement.

Reads for analytics/reports come from existing `sales` joined to `customers` (Sales module untouched).

## Routes (new files under `src/routes/_authenticated/m/`)

Keep hub `crm.tsx`, wire its buttons to these:

- `crm.customers.tsx` — All Customers list: search, filter (type/status), sort, row click → profile. Header "Add Customer" opens drawer.
- `crm.customers.$id.tsx` — Profile: details, totals (from sales), last purchase, recent sales list, Edit/Delete actions.
- `crm.segments.tsx` — Grid of 4 preset segments (VIP/High Value/New/Returning, computed from sales) + Custom Segments list with create/edit/delete. Clicking a segment shows its customers.
- `crm.campaigns.tsx` — List of campaigns with status/budget/dates + "New Campaign" drawer. Row → simple performance panel (placeholder metrics derived from segment size + budget).
- `crm.analytics.tsx` — Cards: Total, New this month, Growth %, CLV, Purchase Frequency, Retention. Date-range selector (30/90/365 days).
- `crm.channels.tsx` — List of channels, add/edit drawer, per-channel customer count.
- `crm.reports.tsx` — Buttons for Growth, Sales by Customer, Location, Marketing — each renders a table below with filters.

Hub `crm.tsx`: cards + more-options list navigate to the routes above (no more toasts).

## Drawer pattern

Single reusable `src/components/crm/top-drawer.tsx`:
- `fixed inset-0 z-50`, overlay `bg-black/50`, panel slides down from top (`translate-y` transition), rounded bottom, max-h 85vh, scrollable body, Close (X) + Save footer.
- Used by: New/Edit Customer, New/Edit Segment, New/Edit Campaign, New/Edit Channel.

Forms use `react-hook-form` + `zod` (already in stack) with inline field errors and a sonner toast on success. On save: invalidate the relevant `useQuery` key so the list updates immediately.

## Data layer

Server functions under `src/lib/crm.functions.ts` using `requireSupabaseAuth`:
- customers: `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer`
- segments: `listSegments`, `createSegment`, `updateSegment`, `deleteSegment`, `getSegmentCustomers`
- campaigns: `listCampaigns`, `createCampaign`, `updateCampaign`, `deleteCampaign`
- channels: `listChannels`, `createChannel`, `updateChannel`
- analytics: `getCrmAnalytics(range)`
- reports: `getGrowthReport`, `getSalesByCustomer`, `getLocationReport`, `getMarketingReport`

TanStack Query for all reads (`ensureQueryData` in loaders, `useSuspenseQuery` in components), `useMutation` + `invalidateQueries` for writes.

## UI reuse

- Keep sunset background wrapper, glass cards, amber accents, bottom nav from existing hub.
- Reuse `Button`, `Input`, `Select`, `Table` from shadcn already in project.
- Mobile: cards stack, drawer is full-width; desktop: `max-w-6xl`, 2–3 column grids.

## Out of scope

- Sales module untouched.
- No new auth, no Supabase edge functions.
- Campaign delivery (actual SMS/email sending) is not wired — only records + placeholder performance.

## Deliverables checklist

- Migration adds columns, 3 new tables, GRANTs, RLS, seed channels.
- 7 new route files + 1 dynamic profile route.
- 1 shared TopDrawer component + form components per entity.
- `crm.functions.ts` with server functions.
- Hub `crm.tsx` updated: every button routes to a real page.
