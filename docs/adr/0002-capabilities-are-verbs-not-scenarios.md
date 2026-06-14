# Capabilities Are Verbs, Not Scenarios

The AI overlay sits on the Capability Registry and must support open-ended business
flows — e.g. "customer confirms a quote by email → convert the quote to an order →
attach it to a reply draft → send", plus future flows like EDI import, order-status /
delivery-date answers, supplier order-confirmation affecting the goods-receipt
purchase order, and reporting. We deliberately model **none** of these as a dedicated
capability or route (no `confirmQuoteFromMail`). Instead, every capability is named
after its effect (`sales.document.convert`, `communication.emailOutbox.prepareSend`,
`communication.emailOutbox.confirmSend`), and scenarios are composed **at runtime** by
the agent-loop: read context, evaluate body/attachments under uncertainty, resolve
references, then chain atomic write-verbs. Transactional invariants live *inside* a
single capability (`convert` is atomic); orchestration *across* capabilities is the
model's job, gated only at write-boundaries.

We chose this because the previous AI architecture pre-wired scenario routes (a bespoke
plan/step DSL executed server-side), which froze decisions too early and ignored decisive
signals still present in the material — the exact failure mode we are eliminating. The
trade-off is that multi-step reliability now depends on the model's orchestration and on
good capability metadata (`useWhen`/`avoidWhen`/`resultShape`) rather than on a fixed
executor, and that some genuinely composite needs surface as *missing atomic verbs* that
must be added (e.g. server-side PDF materialization for `prepareSend`, which today the web
layer renders). The payoff: new capability modules with an `exposure.ai` projection become
available to the overlay automatically, with no overlay code change, and the system stays
open to flows we have not yet imagined.

## Approval grouping

Confirm-gates stay at the write-boundary, not at the scenario boundary. Reading,
reference resolution, draft creation and proposal-building run automatically; every
irreversible/risky write gets its own approval. The full chain is presented to the user
as a single structured, editable Proposal Card, but each write-boundary is confirmed
individually because distinct writes (e.g. `convert` vs. `confirmSend`) carry distinct
risk and may warrant distinct user checks. Confirming each micro-action separately would
rebuild rigid mini-routes in the UX; collapsing all writes into one approval would erase
the risk distinction — so we do neither.
