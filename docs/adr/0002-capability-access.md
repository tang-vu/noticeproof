# ADR 0002: Capability-scoped public cases

Status: accepted

The public MVP will not add full authentication. Private cases use a 256-bit random capability in the URL fragment or client state; only a SHA-256 hash is sent for comparison and stored. Queries and mutations require the capability except for an allowlisted sanitized seeded-demo query. Tokens are never logged or embedded in server-visible URL paths. This keeps judge access frictionless while providing explicit cross-case isolation.
