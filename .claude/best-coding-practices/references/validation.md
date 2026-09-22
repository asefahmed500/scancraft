# Validation — detailed reference

## Principles

**One schema, one source of truth.** Define the shape once (Zod, Yup, class-validator) in a place both the frontend form and the backend route can import. Two hand-maintained validation rule sets — one in the form, one in the route — will drift, and the drift shows up as a confusing "it worked in the form but the API rejected it" bug.

**Validate at every trust boundary — including your own frontend.** The API must never assume a request came from your validated form. A direct `curl`, a compromised frontend, or a bug in a different client all bypass client-side validation entirely. Client-side validation is UX; server-side validation is the actual guarantee.

**Strict vs. coercive parsing is a decision, not a default.** Deciding whether `"5"` should silently become `5` matters — coercion hides bugs (a client sending the wrong type without anyone noticing) as often as it helps convenience. Default to strict; coerce only where you've decided it's genuinely useful.

**Some rules aren't expressible as a type.** "Discharge date must be after admission date." "Invoice total must equal the sum of line items." These are business-rule validations that belong in the service layer, explicitly, with a clear error message — a type system alone won't catch them.

**File uploads need content validation, not just a declared MIME type.** A malicious or malformed file can declare any Content-Type it wants. Check the actual file signature (magic bytes) and enforce size limits before storing anything.

**Config validation belongs at startup, not runtime.** A missing or malformed environment variable should crash the process immediately with a clear message — not surface three hours later as a mysterious 500 in a code path that happened to need it.

## Common anti-patterns

- A form's validation rules re-typed (slightly differently) in the backend route
- An API endpoint trusting `req.body` fields that determine ownership (e.g. a `tenantId` sent by the client and trusted as-is)
- Loose coercion silently converting unexpected types instead of rejecting them
- A discharge-before-admission-style business rule with no explicit check anywhere
- File upload accepted based only on the client-declared MIME type
- An app that starts successfully with a missing required env var, then fails confusingly later

## Checklist

- [ ] One schema shared between the client and the server for each form/entity
- [ ] Every API boundary validates input independently, never trusting the caller
- [ ] Coercion is a deliberate choice per field, not a blanket default
- [ ] Cross-field/business-rule validation exists where types can't express it
- [ ] File uploads are checked by content, not just declared type
- [ ] Startup fails fast and clearly on invalid/missing configuration
