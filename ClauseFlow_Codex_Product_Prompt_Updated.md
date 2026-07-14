# ClauseFlow — Updated Codex Product Prompt

## Working Directory

Build and work inside this folder:

```text
D:\app genlayer\ClauseFlow
```

Create the full project inside this folder.

---

## Your Role

You are Codex acting as a senior product-minded full-stack Web3 engineer.

You will build a complete GenLayer dApp called **ClauseFlow**.

You already have the GenLayer technical documentation and reference materials. Use them for implementation details. This prompt focuses only on ClauseFlow’s product logic, user flow, UX, and required dApp behavior.

Do not treat this as a demo or toy app. Build it as a real, complete dApp v1 with a polished interface and a clear end-to-end workflow.

---

# Product Name

## ClauseFlow

---

# One-Liner

**ClauseFlow is a GenLayer-powered agreement platform where Builders publish ready-to-accept work contract offers, Clients accept an offer by locking GEN into the agreement, and Intelligent Contracts evaluate the final delivery against the accepted clauses before releasing payment, requesting revisions, or enabling refunds after missed deadlines.**

---

# What ClauseFlow Does

ClauseFlow helps Builders and Clients create clear, enforceable work agreements without messy back-and-forth negotiation.

A **Builder** creates a ready-to-accept contract offer.

A **Client** browses available offers from different Builders.

If the Client likes an offer, the Client accepts it and locks the required GEN amount into the agreement in the same flow.

The Builder then completes the work and submits delivery evidence.

GenLayer evaluates the submitted delivery against the exact offer terms the Client accepted.

If the work satisfies the agreement, the Builder gets paid.

If the work is incomplete, ClauseFlow tells the Builder what must be fixed.

If the Builder misses the deadline and does not submit valid work, the Client can receive a refund according to the agreed rules.

---

# Why ClauseFlow Matters

Most freelance, builder, agency, and Web3 service disputes happen because the original agreement is vague.

Examples:

```text
“Build a simple dashboard”
“Make it look professional”
“Finish the dApp”
“Add wallet support”
“Improve the UI”
```

These phrases are easy to misunderstand.

ClauseFlow avoids this by making each Builder offer clear before a Client accepts it.

Each offer must include:

```text
Scope of work
Deliverables
Acceptance criteria
Deadline
Revision rules
Payment amount
Refund rules
```

The important product idea is:

```text
The Builder publishes clear terms first.
The Client only accepts if they agree.
Once accepted, GEN is locked and the agreement becomes enforceable.
GenLayer reviews the Builder’s delivery against the accepted clauses, not vague opinions.
```

---

# Core Product Loop

The dApp must support this complete loop:

```text
Builder creates a ready-to-accept contract offer
↓
Offer includes scope, deliverables, acceptance criteria, deadline, revision rules, payment amount, and refund rules
↓
Builder signs/publishes the offer on-chain
↓
Client browses available Builder offers
↓
Client chooses one offer
↓
Client accepts the offer and locks the required GEN amount into the agreement
↓
Deal becomes Funded / In Progress
↓
Builder completes the work
↓
Builder submits delivery evidence before the deadline
↓
GenLayer evaluates delivery against the accepted offer
↓
Approved → Builder can claim payment
↓
Revision Required → Builder receives a checklist of what must be fixed and can resubmit within the allowed revision rules
↓
Deadline missed with no valid submission → Client can claim refund according to the accepted offer rules
```

There is no complex negotiation flow in v1. If a Client does not like an offer, they simply do not accept it and can choose another Builder’s offer.

---

# Main Users

## 1. Builder

The Builder creates ready-to-accept contract offers.

Each offer should include:

```text
Offer title
Service description
Scope of work
Deliverables
Acceptance criteria
Price in GEN
Deadline
Revision rounds
Revision window
Grace period
Refund rule
Reference URLs or portfolio URLs, if any
```

When the Builder publishes an offer, they are committing to complete the work under those terms if a Client accepts and funds it.

The Builder can:

```text
Create a contract offer
Publish the offer
View accepted deals
Submit delivery evidence
View GenLayer review results
See revision instructions
Resubmit work if revision is allowed
Claim payment after approval
```

---

## 2. Client

The Client browses contract offers created by Builders.

The Client can:

```text
View available offers
Compare scope, price, deadline, revision rules, and acceptance criteria
Accept an offer
Lock GEN into the accepted agreement
Track delivery status
Review GenLayer outcome
Receive refund if the Builder misses the deadline or fails according to agreement rules
```

The Client does not need to negotiate in v1. The Client either accepts an existing offer or chooses another one.

---

# Product Positioning

ClauseFlow is not just an escrow app.

It is not simply:

```text
Client locks money
Builder submits work
AI says yes or no
```

The key difference is:

```text
The Builder publishes structured contract clauses first.
The Client accepts those exact clauses by funding the agreement.
GenLayer later reviews delivery only against those accepted clauses.
```

This makes ClauseFlow a structured agreement platform, not a generic AI judge.

GenLayer is used in two important moments:

```text
1. Offer Structuring / Clause Quality
The Builder’s service description is turned into clear, reviewable clauses with scope, deliverables, acceptance criteria, deadline, revision rules, and refund rules.

2. Agreement Execution
The final accepted offer + submitted delivery evidence are evaluated to determine whether to approve payment, request revision, or allow refund.
```

ClauseFlow should not feel like a chatbot. It should feel like a real contract workflow product.

---

# Builder Offer Creation Flow

## Step 1 — Builder Creates Offer

The Builder creates a new offer by entering:

```text
Offer title
Service description
Detailed scope
Expected deliverables
Price in GEN
Deadline
Revision rounds
Revision window
Grace period
Refund rule
Reference URLs or portfolio URLs, if any
```

Example:

```text
Offer Title:
Build a Web3 landing page with wallet connect

Service Description:
I will build a clean landing page for an AI x Web3 project. It will include a hero section, wallet connect UI, waitlist form, and a basic dashboard preview.

Price:
1 GEN

Deadline:
7 days after Client funds the agreement

Revision rounds:
2

Revision window:
48 hours per revision

Grace period:
24 hours after deadline

Refund rule:
If no valid submission is made before deadline + grace period, Client can claim refund.
```

---

## Step 2 — GenLayer Helps Structure the Offer

GenLayer should help transform the Builder’s offer into clean clauses.

The generated/structured offer should include:

```text
Scope of Work
Deliverables
Milestones, if useful
Acceptance Criteria
Deadline
Revision Rules
Payment Terms
Refund Conditions
```

Example structured output:

```text
Scope:
Builder must deliver a public landing page for the Client’s AI x Web3 project.

Deliverables:
- Public landing page URL
- Wallet connect UI
- Waitlist form
- Basic dashboard preview section
- Optional GitHub or deployment link

Acceptance Criteria:
- Public URL must be accessible.
- Wallet connect UI must be present and functional.
- Waitlist form must accept input and show success state.
- Layout must be usable on desktop and mobile.
- Dashboard preview must be visible.
- Maximum 2 revision rounds are included.

Deadline:
7 days after Client funds the agreement.

Payment:
1 GEN released if the delivery satisfies the accepted criteria.

Revision Rule:
If delivery is close but incomplete, Builder receives a revision checklist and may resubmit within the allowed revision window.

Refund Rule:
If Builder does not submit before deadline + grace period, Client can claim refund.
```

The Builder can review the structured clauses before publishing.

In v1, keep this simple:

```text
Builder creates offer
GenLayer structures the offer
Builder publishes the final offer
```

No complex multi-step negotiation is required.

---

# Client Offer Acceptance Flow

The Client browses published offers.

Each offer card should make the key terms clear:

```text
Offer title
Builder address
Price in GEN
Deadline
Revision rounds
Short scope summary
Status
```

When the Client opens an offer, show the full agreement clauses:

```text
Scope
Deliverables
Acceptance Criteria
Deadline
Revision Rules
Payment Terms
Refund Rules
```

If the Client agrees, the Client clicks:

```text
Accept & Lock GEN
```

This action should:

```text
Accept the offer
Create an active deal between this Client and the Builder
Lock the required GEN amount into the agreement
Move the deal to Funded / In Progress
Start the deadline countdown
```

The Builder should not be expected to begin until the Client has accepted and funded the offer.

---

# Work Submission Flow

After the deal is funded, the Builder completes the work.

The Builder submits completed work with:

```text
Delivery URL
Optional GitHub URL
Optional demo URL
Optional documentation URL
Short delivery note
```

Example:

```text
Delivery URL:
https://client-landing-page.vercel.app

GitHub URL:
https://github.com/builder/client-landing-page

Delivery Note:
Implemented landing page, wallet connect UI, waitlist form with success state, responsive layout, and dashboard preview section.
```

The deal status becomes:

```text
Submitted / Under Review
```

---

# GenLayer Review Flow

GenLayer evaluates the submitted work against the exact accepted offer.

It should not evaluate based on vague preference.

It should evaluate based on:

```text
Accepted scope
Deliverables
Acceptance criteria
Deadline rule
Revision rule
Delivery URLs
Builder delivery note
```

The review result should be one of:

```text
Approved
Revision Required
Rejected
```

---

## Approved

Work satisfies the accepted agreement.

Result:

```text
Builder can claim payment.
Deal becomes Approved / Paid.
```

---

## Revision Required

Work is close but incomplete.

Result:

```text
Builder receives a clear checklist of missing or weak items.
Builder can resubmit if revision rounds remain and the revision window is still valid.
```

Example revision result:

```text
Revision Required

Missing items:
- Wallet connect button is visible but not functional.
- Waitlist form does not show a success state after submission.
- Mobile layout breaks on small screens.

Builder should fix these items and resubmit.
```

---

## Rejected

Work clearly fails the agreement or is unrelated.

Result:

```text
Payment is not released.
Client may be able to claim refund if the agreement rules allow it.
```

Use rejection carefully. In most near-complete cases, prefer Revision Required.

---

# Deadline and Overdue Rules

Deadline handling must be clear and deterministic.

The accepted offer should include:

```text
Main deadline
Grace period
Revision deadline/window
Refund rule
```

Recommended defaults:

```text
Deadline: chosen by Builder in the offer
Grace period: 24 hours
Revision rounds: 2
Revision window: 48 hours per revision
```

---

## Case 1 — Builder submits before deadline

```text
GenLayer reviews the work.
Approved → Builder can claim payment.
Revision Required → Builder can revise if revision rounds remain.
Rejected → follows agreement refund/revision rules.
```

---

## Case 2 — Builder does not submit by deadline

```text
Deal enters Grace Period.
Builder can still submit during grace period.
```

---

## Case 3 — Builder does not submit by deadline + grace period

```text
Client can claim refund.
Deal becomes Expired / Refunded.
```

This should not require AI judgment. It is a time-based rule.

---

## Case 4 — Builder submits during grace period

Recommended v1 behavior:

```text
Submission is still allowed and reviewed normally.
```

No late penalty is required in v1 unless simple to support.

---

## Case 5 — Revision Required

If GenLayer returns Revision Required:

```text
Builder receives checklist
Revision count increases
Builder may resubmit within revision window
If revision rounds are exhausted, Client may be allowed to refund or the deal may be marked failed according to the accepted rules
```

Keep revision behavior clear and easy to understand.

---

# Deal Statuses

Use clear lifecycle statuses.

Suggested statuses:

```text
Offer Draft
Offer Published
Accepted / Funded
In Progress
Submitted
Under Review
Approved
Revision Required
Paid
Expired
Refunded
Cancelled
```

The UI should show the current status clearly.

A timeline component would be very useful:

```text
Offer Published → Client Funded → Work Submitted → AI Reviewed → Paid/Refunded
```

---

# Main Screens

The app should stay focused and professional.

## 1. Offers

A list of published Builder offers.

Each offer card should show:

```text
Offer title
Builder address
Price in GEN
Deadline
Revision rounds
Short scope summary
Status
```

Actions:

```text
Create Offer
Open Offer
```

---

## 2. Create Offer

This is where the Builder creates and publishes a ready-to-accept offer.

The page should support:

```text
Offer form
Generate/Structure Clauses with GenLayer
Review structured clauses
Publish Offer
```

The Builder should see the final clauses before publishing.

---

## 3. Offer Detail

This is where the Client reviews an offer.

Show:

```text
Builder
Price
Deadline
Revision rules
Scope
Deliverables
Acceptance criteria
Refund rules
Reference URLs
```

Primary action:

```text
Accept & Lock GEN
```

After accepted and funded, this creates an active deal.

---

## 4. My Deals

Show active and past deals for the connected wallet.

A Client should see:

```text
Deals funded by me
Current status
Deadline
Refund action if overdue
Review result
```

A Builder should see:

```text
Deals assigned to me
Submission action
Revision required checklist
Claim payment action
```

---

## 5. Deal Detail / Execution

This page handles the funded agreement.

Show:

```text
Accepted offer clauses
Locked GEN amount
Deadline countdown
Current deal status
Submission form for Builder
AI review result
Revision checklist
Claim payment button
Refund button if overdue
```

This page is the main execution view after funding.

---

# UX and Visual Design Direction

The interface should look light, calm, modern, and professional.

Do not make it look like a rough scaffold.

Preferred feel:

```text
Soft
Minimal
Elegant
Readable
Trustworthy
Founder/product tool style
```

Visual direction:

```text
Light or soft neutral theme
Lots of whitespace
Rounded cards
Subtle borders
Gentle shadows
Soft accent color
Readable typography
Beautiful font
```

Font direction:

```text
Use a clean modern sans-serif font.
Good options: Inter, Satoshi, Geist, Manrope, or similar.
Avoid harsh default browser fonts.
```

Color direction:

```text
Background: soft white / warm gray / very light blue-gray
Primary accent: calm blue, violet, or teal
Success: soft green
Warning: amber
Error: soft red
Text: dark slate / neutral black
```

The app should feel more like:

```text
Linear
Stripe
Notion
Vercel
Modern Web3 SaaS
```

and less like:

```text
Default crypto dashboard
Overly dark gaming UI
Raw boilerplate
```

Important UI components:

```text
Offer cards
Clause cards
Status badges
Agreement timeline
Locked funds panel
Deadline countdown
AI review result panel
Revision checklist
Payment/refund action buttons
```

The “AI Review Result” should be very clear and professional:

```text
Approved / Revision Required / Rejected
Score or confidence
Short reason
Checklist of missing items if revision is required
Next action
```

---

# What Makes ClauseFlow a Complete dApp

ClauseFlow must feel like a real product, not a demo.

It should include:

```text
Clear user roles
Builder offer creation
GenLayer clause structuring
Published ready-to-accept offers
Client acceptance with GEN funding
End-to-end deal lifecycle
Work submission
AI review against accepted clauses
Revision handling
Deadline/refund handling
Payment claim flow
Readable documentation
Polished UI
```

Do not over-expand into unrelated features.

Do not add marketplace messaging, team management, analytics, or complex dispute systems unless the core flow is already complete.

---

# Example Demo Scenario

Use this scenario as the default example in docs or seed data.

## Builder Offer

```text
Title:
Build a Web3 landing page with wallet connect

Service Description:
I will build a clean landing page for an AI x Web3 project. It will include wallet connect UI, a waitlist form, responsive layout, and a basic dashboard preview.

Price:
1 GEN

Deadline:
7 days after Client funds the agreement

Revision rounds:
2

Grace period:
24 hours
```

## Structured Clauses Should Include

```text
Scope of work
Deliverables
Acceptance criteria
Deadline
Revision rules
Payment rule
Refund rule
```

## Client Action

```text
Client reviews the offer.
Client clicks Accept & Lock GEN.
1 GEN is locked into the deal.
Deadline countdown starts.
```

## Good Submission

```text
Delivery URL:
https://example-landing.vercel.app

GitHub URL:
https://github.com/example/builder-landing

Delivery Note:
Implemented responsive landing page, wallet connect UI, waitlist form with success state, and dashboard preview section.
```

Expected result:

```text
Approved
Builder can claim payment
```

## Incomplete Submission

```text
Delivery URL exists, but wallet connect is not functional and waitlist form has no success state.
```

Expected result:

```text
Revision Required
Checklist:
- Wallet connect must be functional
- Waitlist form must show success state
- Mobile layout should be fixed if broken
```

## Missed Deadline

```text
Builder submits nothing before deadline + grace period.
```

Expected result:

```text
Client can claim refund
Deal status becomes Refunded
```

---

# README Requirements

The final repo should include a clear README explaining:

```text
What ClauseFlow is
Why GenLayer is required
User roles
Builder offer flow
Client acceptance and funding flow
Full deal lifecycle
How clause structuring works
How work review works
How deadlines/refunds work
How to run the app
How to demo the app
```

The README should emphasize:

```text
ClauseFlow does not just ask AI for advice.
ClauseFlow uses GenLayer to structure and execute agreements with on-chain state, escrow, deadlines, review outcomes, payment, and refund logic.
```

---

# Final Instruction

Build **ClauseFlow** as a complete GenLayer dApp v1.

The core flow must remain:

```text
Builder creates offer
↓
GenLayer structures offer into clear clauses
↓
Builder publishes offer
↓
Client accepts offer and locks GEN
↓
Builder submits work
↓
GenLayer reviews work against accepted offer
↓
Approve / request revision / refund on missed deadline
```

Keep the interface polished, light, calm, and professional.

Do not rename the product.

Do not reduce the app into a simple AI text generator.

Do not turn it into a generic proof/reward campaign.

The product must feel like a real agreement platform powered by GenLayer.
