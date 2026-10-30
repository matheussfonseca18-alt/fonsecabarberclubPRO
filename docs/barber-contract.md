# Barber area: proposed contract and activation boundary

This isolated prototype uses an inactive read-only adapter. It makes no network
requests, reads no authentication credentials, stores nothing, and exposes no
production write method. An unavailable read is not an empty agenda, zero revenue,
zero commission, or a claim that a professional has no appointments.

## Evidence and remaining unknowns

The observed product supports agenda day controls and labels for services and
products. The professional role's actual permissions, tenant and professional
bindings, and commission calculation/settlement semantics have not been verified.
Everything below is a proposal for review, not a description of an existing
backend or authorization policy.

## Proposed navigation

| Role      | Default area   | Proposed navigation areas |
| --------- | -------------- | ------------------------- |
| owner     | administration | administration, barber    |
| admin     | administration | administration, barber    |
| reception | administration | administration            |
| barber    | barber         | barber                    |

`PROPOSED_ROLE_NAVIGATION` is an extensible presentation mapping. It grants no
permissions. A public route, a query parameter, a selected role, or client-side
filtering must never establish identity or authorize a backend request. Existing
administrative capabilities and actual role assignment require separate review.

## Server-owned identity and assigned appointments

A future authenticated server must independently bind `tenantId`, `actorId`,
`professionalId` and an opaque `sessionId` to the authenticated session. The
session binding is not a token. Browser inputs must not override these fields.
Every server query must enforce both tenant and assigned-professional scope
before sending a response; no full customer directory or team agenda is returned.

`BarberDataAdapter.readScope(signal)` reads the independent server/session scope.
`subscribeScope(listener)` is the proposed immediate invalidation signal: the UI
must clear sensitive snapshots and linked drafts, abort pending reads and obtain
a fresh independent scope before reading again. Inactive scope reads return
unavailable and the inactive subscription is a no-op with an unsubscribe function.

`BarberDataAdapter.readDay({ day, signal })` intentionally accepts no tenant,
actor, professional, role or financial query. Its only current implementation is
`inactiveBarberAdapter`, which always returns `state: "unavailable"`.

The proposed response contains a scope, day, explicit time zone, assigned
appointments, own performance and own commission. Appointment DTOs contain only
an opaque appointment ID, tenant/professional binding, start/end timestamps,
`customer.displayName`, service labels and a server status label. They contain no
telephone, email, address, customer record ID or full customer record. UI rendering
must escape all labels and descriptions as text.

`projectBarberSnapshot(raw, expectedScope)` validates and explicitly projects the
response. `expectedScope` must come from an independently trusted server session
source, never from the same untrusted payload or browser input. An invalid scope,
any other tenant/professional row, mismatched actor/session, malformed row or
duplicate appointment ID rejects the entire snapshot. The function never filters
an overbroad response and presents the remainder as authorized. Its projection
strips extra fields. This is defense in depth and is not backend authorization.
`isTrustedBarberScopeShape` validates only the shape of an independently obtained
scope; its name and successful result do not make a caller-supplied scope trusted.

The response has at most 200 appointments, with at most 20 service labels per
appointment. A future adapter must ensure it returns the requested day and handles
aborted or superseded requests. A partial/truncated list must not be presented as
an exhaustive day. There is no pagination or production transport in this stage.

The proposed day policy is the appointment's **start calendar date in the explicit
response time zone**. Projection rejects the whole snapshot if any start belongs
to a different local date. An end after midnight is allowed when it follows the
start. This policy is a proposal for this contract, not verified AppBarber parity.

## Own performance and commission

Every metric explicitly distinguishes `{ state: "unknown" }` from
`{ state: "known", value: 0 }`. An empty valid appointment list means the server
returned an empty list; it does not turn any unknown summary into zero.

The own performance fields are server-supplied completed appointment, service unit
and product unit counts. They are nonnegative safe integers. They are never
calculated from draft items or inferred from appointment status labels.

Commission is either unknown or a server-supplied signed integer `minorUnits`
amount with an explicit three-letter uppercase `currency`. The period label is
server supplied or null. Signed amounts are preserved because adjustment
semantics remain unknown. No percentage, formula, commission rate, projection,
team total, business revenue or customer-wide financial view exists. A future
server contract must establish period, currency unit and settlement semantics
before monetary displays are activated.

## Local draft semantics

Drafts live only in memory and are discarded on reload. Local create, update and
remove operations accept a manual service/product description (1–120 characters)
and integer quantity (1–99). Descriptions are trimmed. There are at most 20 lines.
Line IDs are local sequential identifiers, never catalog or database IDs. No
prices, customer fields, totals, commissions or catalog records are supported.
The functions project input fields instead of retaining unexpected properties.

An unlinked local draft can be used while data access is unavailable. Linking is
allowed only to a currently visible own appointment under a verified scope.
`reconcileDraftContext` clears the entire linked draft when the tenant, actor,
professional, session, selected appointment, or appointment visibility changes.
Call it after every such context change and when a read becomes unavailable. A
link operation that changes scope first clears existing linked content. Unlinked
drafts carry no appointment or customer binding and can remain local.

There is no save/submit writer in the adapter or domain API. A local draft result
must never be described as persisted, a confirmed sale, a paid service, or an
updated production appointment. Future writes, catalog linking, pricing and
commission behavior require a separately reviewed server contract.

## Verification

`tests/barber-domain.test.ts` uses explicitly synthetic fixtures and checks scope
rejection, minimal projection, unknown/zero distinction, local draft CRUD limits
and context isolation. These unit tests verify the prototype boundary only; they
do not verify the unobserved backend's authorization or commission semantics.
