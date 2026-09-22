# Frontend — detailed reference

## Principles

**Component composition.** Build from atoms (Button, Input, Badge) → molecules (FormField, TableRow) → organisms (DataTable, Sidebar) → templates → pages. A component doing layout, data fetching, and business logic at once is the most common source of "this file is 800 lines and nobody wants to touch it." Rule of thumb: if a component exceeds ~150 lines, it's usually mixing concerns that should split.

**Server state vs. client state.** These are different problems and mixing them causes stale-data bugs. Server state (anything from an API) belongs in a data-fetching library (TanStack Query, SWR, RTK Query) which handles caching, refetching, and invalidation for you. Client state (is this modal open, which tab is active) belongs in local `useState` or a light store (Zustand). A `useEffect` that fetches into `useState` is usually the anti-pattern here — it reinvents caching badly.

**Shared validation.** The same schema (Zod, Yup) that validates a form client-side should be imported by the API route that receives it. Two independently-maintained validation rule sets will drift, and the drift always surfaces as a confusing bug report from a real user.

**Data at scale.** ERPs and admin tools routinely render lists in the thousands. Two techniques matter: virtualization (only render visible rows — TanStack Virtual, react-window) and server-side pagination/filtering/sorting (never ship the whole table to the browser and filter client-side "for now" — it never gets fixed later).

**Role-based rendering is UX, not security.** Hide/disable what a user can't do, for a good experience — but the server must enforce the same rule independently. A hidden button is not access control.

## Common anti-patterns

- Fetching in `useEffect` + storing in `useState`, duplicating what a query library does better and introduces race conditions on rapid re-renders
- One giant "SettingsPage" component handling ten unrelated concerns
- Client-side filtering/sorting on a dataset that's already too large to fetch in full
- Memoizing everything reflexively (`useMemo` around a cheap string concat) — adds complexity with no measured benefit
- No skeleton/empty/error state — just a spinner, or worse, a blank screen on error
- Validation logic duplicated (slightly differently) in the form and on the backend

## Checklist

- [ ] Components under ~150 lines; each one doing roughly one job
- [ ] Server state in a query library; client state kept separate
- [ ] Form validation schema imported from (or shared with) the backend
- [ ] Large lists paginated/filtered server-side, virtualized if long
- [ ] Every data view has loading, empty, and error states
- [ ] Restricted actions hidden/disabled in the UI *and* rejected server-side
- [ ] Keyboard navigation and visible focus states work without a mouse
