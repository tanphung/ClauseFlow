# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from datetime import datetime, timezone
import json


STATUS_OFFER_PUBLISHED = "OFFER_PUBLISHED"
STATUS_FUNDED = "FUNDED"
STATUS_SUBMITTED = "SUBMITTED"
STATUS_APPROVED = "APPROVED"
STATUS_REVISION_REQUIRED = "REVISION_REQUIRED"
STATUS_REJECTED = "REJECTED"
STATUS_PAYMENT_PENDING = "PAYMENT_PENDING"
STATUS_REFUND_PENDING = "REFUND_PENDING"
STATUS_PAID = "PAID"
STATUS_REFUNDED = "REFUNDED"

EVENT_OFFER_PUBLISHED = "OFFER_PUBLISHED"
EVENT_FUNDED = "FUNDED"
EVENT_SUBMITTED = "SUBMITTED"
EVENT_REVIEWED = "REVIEWED"
EVENT_PAYMENT_PENDING = "PAYMENT_PENDING"
EVENT_REFUND_PENDING = "REFUND_PENDING"
EVENT_PAID = "PAID"
EVENT_REFUNDED = "REFUNDED"


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


class ClauseFlow(gl.Contract):
    owner: Address
    next_offer_id: u256
    next_deal_id: u256
    offers: TreeMap[str, str]
    offer_ids: DynArray[str]
    deals: TreeMap[str, str]
    deal_ids: DynArray[str]
    completed_deal_ids: DynArray[str]
    deal_histories: TreeMap[str, str]
    structured_offer_drafts: TreeMap[str, str]
    total_funded_atto: u256
    total_paid_atto: u256
    total_refunded_atto: u256
    accounted_escrow_atto: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_offer_id = 1
        self.next_deal_id = 1
        self.total_funded_atto = 0
        self.total_paid_atto = 0
        self.total_refunded_atto = 0
        self.accounted_escrow_atto = 0

    @gl.public.write
    def structure_offer(
        self,
        title: str,
        service_description: str,
        scope: str,
        deliverables: str,
        acceptance_criteria: str,
        price_atto_gen: u256,
        deadline_days: u256,
        revision_rounds: u256,
        revision_window_hours: u256,
        grace_period_hours: u256,
        refund_rule: str,
    ) -> str:
        if price_atto_gen <= 0:
            raise gl.vm.UserError("Price must be greater than zero")
        if deadline_days <= 0:
            raise gl.vm.UserError("Deadline must be at least one day")
        required_text = [title, service_description, scope, deliverables, acceptance_criteria, refund_rule]
        for value in required_text:
            if len(_clean(value)) == 0:
                raise gl.vm.UserError("Offer terms cannot be empty")

        source = {
            "title": _clean_limit(title, 160),
            "serviceDescription": _clean_limit(service_description, 700),
            "scope": _clean_limit(scope, 900),
            "deliverables": _clean_limit(deliverables, 900),
            "acceptanceCriteria": _clean_limit(acceptance_criteria, 1000),
            "priceAttoGen": str(price_atto_gen),
            "priceDisplay": _format_gen(price_atto_gen),
            "deadlineDays": str(deadline_days),
            "revisionRounds": str(revision_rounds),
            "revisionWindowHours": str(revision_window_hours),
            "gracePeriodHours": str(grace_period_hours),
            "refundRule": _clean_limit(refund_rule, 700),
        }

        def leader_fn():
            result = gl.nondet.exec_prompt(_clause_prompt(source), response_format="json")
            return _normalize_structured_clauses(result, source)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            leader = leaders_res.calldata
            return _structured_clauses_materially_valid(leader, source)

        structured = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        builder = str(gl.message.sender_address)
        builder_key = builder.lower()
        draft = {
            "builder": builder,
            "title": title,
            "serviceDescription": service_description,
            "scope": scope,
            "deliverables": deliverables,
            "acceptanceCriteria": acceptance_criteria,
            "priceAttoGen": str(price_atto_gen),
            "deadlineDays": str(deadline_days),
            "revisionRounds": str(revision_rounds),
            "revisionWindowHours": str(revision_window_hours),
            "gracePeriodHours": str(grace_period_hours),
            "refundRule": refund_rule,
            "clauses": structured,
            "structuredAt": _now_iso(),
            "publishedOfferId": "",
        }
        self.structured_offer_drafts[builder_key] = json.dumps(draft, sort_keys=True)
        return json.dumps(structured, sort_keys=True)

    @gl.public.write
    def publish_offer(
        self,
        title: str,
        service_description: str,
        scope: str,
        deliverables: str,
        acceptance_criteria: str,
        price_atto_gen: u256,
        deadline_days: u256,
        revision_rounds: u256,
        revision_window_hours: u256,
        grace_period_hours: u256,
        refund_rule: str,
        reference_urls: str,
    ) -> str:
        if price_atto_gen <= 0:
            raise gl.vm.UserError("Price must be greater than zero")
        if deadline_days <= 0:
            raise gl.vm.UserError("Deadline must be at least one day")

        builder = str(gl.message.sender_address)
        builder_key = builder.lower()
        if builder_key not in self.structured_offer_drafts:
            raise gl.vm.UserError("Structure and review the offer clauses before publishing")
        draft = _loads(self.structured_offer_drafts[builder_key])
        if draft["publishedOfferId"] != "":
            raise gl.vm.UserError("This structured draft has already been published")
        if not _draft_matches_offer(
            draft,
            title,
            service_description,
            scope,
            deliverables,
            acceptance_criteria,
            price_atto_gen,
            deadline_days,
            revision_rounds,
            revision_window_hours,
            grace_period_hours,
            refund_rule,
        ):
            raise gl.vm.UserError("Offer fields changed after structuring; structure the clauses again")

        offer_id = str(self.next_offer_id)
        self.next_offer_id += 1
        now = _now_iso()
        offer = {
            "id": offer_id,
            "builder": builder,
            "title": title,
            "serviceDescription": service_description,
            "scope": scope,
            "deliverables": deliverables,
            "acceptanceCriteria": acceptance_criteria,
            "structuredClauses": json.dumps(draft["clauses"], sort_keys=True),
            "priceAttoGen": str(price_atto_gen),
            "deadlineDays": str(deadline_days),
            "revisionRounds": str(revision_rounds),
            "revisionWindowHours": str(revision_window_hours),
            "gracePeriodHours": str(grace_period_hours),
            "refundRule": refund_rule,
            "referenceUrls": reference_urls,
            "status": STATUS_OFFER_PUBLISHED,
            "publishedAt": now,
        }
        self.offers[offer_id] = json.dumps(offer, sort_keys=True)
        self.offer_ids.append(offer_id)
        draft["publishedOfferId"] = offer_id
        self.structured_offer_drafts[builder_key] = json.dumps(draft, sort_keys=True)
        return offer_id

    @gl.public.write.payable
    def accept_offer(self, offer_id: str) -> str:
        offer = _loads(self.offers[offer_id])
        price = int(offer["priceAttoGen"])
        if int(gl.message.value) != price:
            raise gl.vm.UserError("Accepted amount must match the offer price")

        deal_id = str(self.next_deal_id)
        self.next_deal_id += 1
        now = _now_iso()
        now_unix = _now_unix()
        deadline_unix = now_unix + (int(offer["deadlineDays"]) * 86400)
        refund_unix = deadline_unix + (int(offer["gracePeriodHours"]) * 3600)
        deal = {
            "id": deal_id,
            "offerId": offer_id,
            "title": offer["title"],
            "builder": offer["builder"],
            "client": str(gl.message.sender_address),
            "lockedAttoGen": str(price),
            "status": STATUS_FUNDED,
            "revisionCount": "0",
            "maxRevisions": offer["revisionRounds"],
            "deadlineDays": offer["deadlineDays"],
            "gracePeriodHours": offer["gracePeriodHours"],
            "fundedAt": now,
            "deadlineAtUnix": str(deadline_unix),
            "refundAvailableAtUnix": str(refund_unix),
            "submittedAt": "",
            "reviewedAt": "",
            "completedAt": "",
            "paidAt": "",
            "refundedAt": "",
            "deliveryUrl": "",
            "githubUrl": "",
            "demoUrl": "",
            "documentationUrl": "",
            "deliveryNote": "",
            "reviewResult": "",
            "reviewScore": "0",
            "reviewReason": "",
            "revisionChecklist": "",
            "reviewEvidenceSummary": "",
            "reviewCriteriaResults": "",
            "reviewMissingItems": "",
            "nextAction": "Builder should submit delivery evidence before the deadline.",
            "paymentTxType": "",
            "settlementBalanceBeforeAtto": "0",
            "escrowAccountedAfterAtto": "0",
            "paid": "false",
            "refunded": "false",
        }
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self.deal_ids.append(deal_id)
        self.deal_histories[deal_id] = "[]"
        self.total_funded_atto += price
        self.accounted_escrow_atto += price
        self._append_history(deal_id, EVENT_FUNDED, "Client accepted offer and locked GEN.", now)
        return deal_id

    @gl.public.write
    def submit_delivery(
        self,
        deal_id: str,
        delivery_url: str,
        github_url: str,
        demo_url: str,
        documentation_url: str,
        delivery_note: str,
    ) -> None:
        deal = _loads(self.deals[deal_id])
        if deal["builder"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only the builder can submit delivery")
        if deal["status"] not in [STATUS_FUNDED, STATUS_REVISION_REQUIRED]:
            raise gl.vm.UserError("Deal is not open for delivery")
        if not _is_url(delivery_url):
            raise gl.vm.UserError("Delivery URL must be http(s)")
        if int(deal["refundAvailableAtUnix"]) < _now_unix():
            raise gl.vm.UserError("Submission window has expired")
        if deal["status"] == STATUS_REVISION_REQUIRED and int(deal["revisionCount"]) >= int(deal["maxRevisions"]):
            raise gl.vm.UserError("Revision rounds are exhausted")

        now = _now_iso()
        deal["deliveryUrl"] = delivery_url
        deal["githubUrl"] = github_url
        deal["demoUrl"] = demo_url
        deal["documentationUrl"] = documentation_url
        deal["deliveryNote"] = delivery_note
        deal["submittedAt"] = now
        deal["status"] = STATUS_SUBMITTED
        deal["nextAction"] = "Delivery submitted. Run GenLayer review against accepted clauses."
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self._append_history(deal_id, EVENT_SUBMITTED, "Builder submitted delivery evidence.", now)

    @gl.public.write
    def review_delivery(self, deal_id: str) -> str:
        deal = _loads(self.deals[deal_id])
        offer = _loads(self.offers[deal["offerId"]])
        if deal["status"] != STATUS_SUBMITTED:
            raise gl.vm.UserError("Deal must be submitted before review")

        def leader_fn():
            evidence = _fetch_delivery_evidence(deal)
            return _evaluate_delivery_review(offer, deal, evidence)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            validator_evidence = _fetch_delivery_evidence(deal)
            leader = leaders_res.calldata
            validator = _evaluate_delivery_review(offer, deal, validator_evidence)
            return _review_results_compatible(leader, validator)

        review = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        result = str(review["result"])
        now = _now_iso()
        if result == STATUS_APPROVED:
            deal["status"] = STATUS_APPROVED
            deal["nextAction"] = "Builder can claim payment."
        elif result == STATUS_REJECTED:
            deal["status"] = STATUS_REJECTED
            deal["nextAction"] = "Client can claim refund according to agreement rules."
        else:
            next_revision_count = int(deal["revisionCount"]) + 1
            deal["revisionCount"] = str(next_revision_count)
            if next_revision_count >= int(deal["maxRevisions"]):
                deal["status"] = STATUS_REJECTED
                deal["nextAction"] = "Revision rounds are exhausted. Client can claim refund."
                result = STATUS_REJECTED
                review["result"] = STATUS_REJECTED
            else:
                deal["status"] = STATUS_REVISION_REQUIRED
                deal["nextAction"] = str(review["nextAction"])

        deal["reviewedAt"] = now
        deal["reviewResult"] = result
        deal["reviewScore"] = str(review["score"])
        deal["reviewReason"] = str(review["reason"])
        deal["revisionChecklist"] = str(review["checklist"])
        deal["reviewEvidenceSummary"] = str(review["evidenceSummary"])
        deal["reviewCriteriaResults"] = str(review["criteriaResults"])
        deal["reviewMissingItems"] = str(review["missingItems"])
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self._append_history(deal_id, EVENT_REVIEWED, _review_history_note(review), now)
        return json.dumps(review, sort_keys=True)

    @gl.public.write
    def claim_payment(self, deal_id: str) -> None:
        deal = _loads(self.deals[deal_id])
        if deal["builder"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only the builder can claim payment")
        if deal["status"] != STATUS_APPROVED:
            raise gl.vm.UserError("Deal must be approved before payment")
        if deal["paid"] == "true" or deal["refunded"] == "true":
            raise gl.vm.UserError("Deal already settled")
        amount = int(deal["lockedAttoGen"])
        if amount > int(self.accounted_escrow_atto):
            raise gl.vm.UserError("Escrow accounting is insufficient for this payment")
        now = _now_iso()
        deal["status"] = STATUS_PAYMENT_PENDING
        deal["settlementBalanceBeforeAtto"] = str(self.balance)
        self.accounted_escrow_atto -= amount
        deal["escrowAccountedAfterAtto"] = str(self.accounted_escrow_atto)
        deal["paymentTxType"] = "EXTERNAL_GEN_TRANSFER_TO_BUILDER"
        deal["nextAction"] = "Payment emitted. Wait for parent finalization, then confirm the escrow balance change."
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self._append_history(deal_id, EVENT_PAYMENT_PENDING, "Payment transfer emitted and awaiting finalization.", now)
        _Recipient(Address(deal["builder"])).emit_transfer(value=u256(amount))

    @gl.public.write
    def confirm_payment(self, deal_id: str) -> None:
        deal = _loads(self.deals[deal_id])
        if deal["status"] != STATUS_PAYMENT_PENDING:
            raise gl.vm.UserError("Payment is not awaiting confirmation")
        amount = int(deal["lockedAttoGen"])
        expected_balance = int(deal["escrowAccountedAfterAtto"])
        if int(self.balance) > expected_balance:
            raise gl.vm.UserError("Escrow balance has not reflected the payment yet")
        now = _now_iso()
        deal["status"] = STATUS_PAID
        deal["paid"] = "true"
        deal["paidAt"] = now
        deal["completedAt"] = now
        deal["nextAction"] = "Agreement completed and GEN payment verified."
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self.completed_deal_ids.append(deal_id)
        self.total_paid_atto += amount
        self._append_history(deal_id, EVENT_PAID, "GEN payment verified from escrow balance.", now)

    @gl.public.write
    def claim_refund(self, deal_id: str) -> None:
        deal = _loads(self.deals[deal_id])
        if deal["client"] != str(gl.message.sender_address):
            raise gl.vm.UserError("Only the client can claim refund")
        if deal["paid"] == "true" or deal["refunded"] == "true":
            raise gl.vm.UserError("Deal already settled")
        if not _refund_allowed(deal):
            raise gl.vm.UserError("Refund is not available for this status")
        amount = int(deal["lockedAttoGen"])
        if amount > int(self.accounted_escrow_atto):
            raise gl.vm.UserError("Escrow accounting is insufficient for this refund")
        now = _now_iso()
        deal["status"] = STATUS_REFUND_PENDING
        deal["settlementBalanceBeforeAtto"] = str(self.balance)
        self.accounted_escrow_atto -= amount
        deal["escrowAccountedAfterAtto"] = str(self.accounted_escrow_atto)
        deal["paymentTxType"] = "EXTERNAL_GEN_TRANSFER_TO_CLIENT"
        deal["nextAction"] = "Refund emitted. Wait for parent finalization, then confirm the escrow balance change."
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self._append_history(deal_id, EVENT_REFUND_PENDING, "Refund transfer emitted and awaiting finalization.", now)
        _Recipient(Address(deal["client"])).emit_transfer(value=u256(amount))

    @gl.public.write
    def confirm_refund(self, deal_id: str) -> None:
        deal = _loads(self.deals[deal_id])
        if deal["status"] != STATUS_REFUND_PENDING:
            raise gl.vm.UserError("Refund is not awaiting confirmation")
        amount = int(deal["lockedAttoGen"])
        expected_balance = int(deal["escrowAccountedAfterAtto"])
        if int(self.balance) > expected_balance:
            raise gl.vm.UserError("Escrow balance has not reflected the refund yet")
        now = _now_iso()
        deal["status"] = STATUS_REFUNDED
        deal["refunded"] = "true"
        deal["refundedAt"] = now
        deal["completedAt"] = now
        deal["nextAction"] = "Agreement completed and GEN refund verified."
        self.deals[deal_id] = json.dumps(deal, sort_keys=True)
        self.completed_deal_ids.append(deal_id)
        self.total_refunded_atto += amount
        self._append_history(deal_id, EVENT_REFUNDED, "GEN refund verified from escrow balance.", now)

    @gl.public.view
    def get_structured_offer(self, builder: str) -> str:
        key = str(builder).lower()
        return self.structured_offer_drafts[key] if key in self.structured_offer_drafts else ""

    @gl.public.view
    def get_offer(self, offer_id: str) -> str:
        return self.offers[str(offer_id)]

    @gl.public.view
    def get_deal(self, deal_id: str) -> str:
        return self.deals[str(deal_id)]

    @gl.public.view
    def get_offer_ids(self) -> str:
        ids = []
        for offer_id in self.offer_ids:
            ids.append(offer_id)
        return json.dumps(ids)

    @gl.public.view
    def get_deal_ids(self) -> str:
        ids = []
        for deal_id in self.deal_ids:
            ids.append(deal_id)
        return json.dumps(ids)

    @gl.public.view
    def get_completed_deal_ids(self) -> str:
        ids = []
        for deal_id in self.completed_deal_ids:
            ids.append(deal_id)
        return json.dumps(ids)

    @gl.public.view
    def get_deals_for_address(self, account: str) -> str:
        ids = []
        needle = str(account).lower()
        for deal_id in self.deal_ids:
            deal = _loads(self.deals[deal_id])
            if deal["builder"].lower() == needle or deal["client"].lower() == needle:
                ids.append(deal_id)
        return json.dumps(ids)

    @gl.public.view
    def get_deal_history(self, deal_id: str) -> str:
        return self.deal_histories[str(deal_id)]

    @gl.public.view
    def get_dashboard_stats(self) -> str:
        completed = 0
        funded = 0
        for deal_id in self.deal_ids:
            deal = _loads(self.deals[deal_id])
            if deal["status"] in [STATUS_PAID, STATUS_REFUNDED]:
                completed += 1
            if deal["status"] in [STATUS_FUNDED, STATUS_SUBMITTED, STATUS_APPROVED, STATUS_REVISION_REQUIRED, STATUS_PAYMENT_PENDING, STATUS_REFUND_PENDING]:
                funded += 1
        stats = {
            "totalOffers": str(len(self.offer_ids)),
            "totalDeals": str(len(self.deal_ids)),
            "activeDeals": str(funded),
            "completedDeals": str(completed),
            "totalFundedAtto": str(self.total_funded_atto),
            "totalPaidAtto": str(self.total_paid_atto),
            "totalRefundedAtto": str(self.total_refunded_atto),
            "contractBalanceAtto": str(self.balance),
            "accountedEscrowAtto": str(self.accounted_escrow_atto),
        }
        return json.dumps(stats, sort_keys=True)

    def _append_history(self, deal_id: str, event_type: str, note: str, timestamp: str) -> None:
        existing = []
        current = self.deal_histories[deal_id]
        if len(current) > 0:
            existing = _loads_array(current)
        existing.append(
            {
                "eventType": event_type,
                "note": note,
                "timestamp": timestamp,
                "actor": str(gl.message.sender_address),
            }
        )
        self.deal_histories[deal_id] = json.dumps(existing, sort_keys=True)


def _loads(value: str) -> dict:
    try:
        return json.loads(value)
    except Exception:
        raise gl.vm.UserError("Stored JSON is invalid")


def _loads_array(value: str) -> list:
    try:
        return json.loads(value)
    except Exception:
        return []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_unix() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _refund_allowed(deal: dict) -> bool:
    if deal["status"] == STATUS_REJECTED:
        return True
    if deal["status"] == STATUS_FUNDED:
        return _now_unix() >= int(deal["refundAvailableAtUnix"])
    if deal["status"] == STATUS_REVISION_REQUIRED:
        if int(deal["revisionCount"]) >= int(deal["maxRevisions"]):
            return True
        return _now_unix() >= int(deal["refundAvailableAtUnix"])
    return False


def _is_url(value: str) -> bool:
    lower = str(value).lower().strip()
    return lower.startswith("https://") or lower.startswith("http://")


def _fetch_url_text(url: str, label: str) -> dict:
    if not _is_url(url):
        return {"label": label, "url": url, "accessible": False, "text": "", "error": "missing_or_invalid_url"}
    try:
        response = gl.nondet.web.get(url)
        text = response.body.decode("utf-8")
        clipped = str(text)[:3000]
        return {"label": label, "url": url, "accessible": len(clipped) > 0, "text": clipped, "error": ""}
    except Exception as exc:
        return {"label": label, "url": url, "accessible": False, "text": "", "error": str(exc)[:240]}


def _fetch_delivery_evidence(deal: dict) -> dict:
    pages = [
        _fetch_url_text(deal["deliveryUrl"], "delivery"),
        _fetch_url_text(deal["demoUrl"], "demo"),
        _fetch_url_text(deal["documentationUrl"], "documentation"),
        _fetch_url_text(deal["githubUrl"], "github"),
    ]
    accessible_count = 0
    for page in pages:
        if page["accessible"]:
            accessible_count += 1
    return {"pages": pages, "accessibleCount": str(accessible_count), "deliveryNote": deal["deliveryNote"]}


def _evaluate_delivery_review(offer: dict, deal: dict, evidence: dict) -> dict:
    accessible_count = int(evidence["accessibleCount"])
    combined = _combined_evidence_text(evidence)
    criteria = _criteria_terms(offer)
    matched = []
    missing = []
    for term in criteria:
        if term in combined:
            matched.append(term)
        else:
            missing.append(term)
    total = len(criteria)
    satisfied = len(matched)
    if accessible_count == 0:
        result = STATUS_REJECTED
        score = 0
    elif total == 0:
        result = STATUS_REVISION_REQUIRED
        score = 50
    else:
        score = (satisfied * 100) // total
        if score >= 70:
            result = STATUS_APPROVED
        elif score >= 35:
            result = STATUS_REVISION_REQUIRED
        else:
            result = STATUS_REJECTED
    criteria_lines = []
    for term in matched:
        criteria_lines.append(f"PASS: public evidence contains '{term}'")
    for term in missing:
        criteria_lines.append(f"FAIL: public evidence does not contain '{term}'")
    evidence_summary = _evidence_summary(evidence, matched)
    missing_text = "\n".join([f"Provide public evidence containing '{term}'." for term in missing])
    if result == STATUS_APPROVED:
        missing_text = ""
    next_action = "Builder can claim payment." if result == STATUS_APPROVED else "Builder should provide stronger public evidence or Client can follow refund rules if rejected."
    return {
        "result": result,
        "score": str(score),
        "reason": f"Validators fetched {accessible_count} public evidence page(s) and matched {satisfied} of {total} material evidence terms.",
        "checklist": missing_text,
        "nextAction": next_action,
        "criteriaSatisfied": str(satisfied),
        "criteriaTotal": str(total),
        "evidenceSummary": evidence_summary,
        "criteriaResults": _clean_limit("\n".join(criteria_lines), 1400),
        "missingItems": _clean_limit(missing_text, 1000),
        "accessibleCount": str(accessible_count),
    }


def _combined_evidence_text(evidence: dict) -> str:
    chunks = [_clean(evidence.get("deliveryNote", "")).lower()]
    for page in evidence["pages"]:
        chunks.append(_clean(page.get("text", "")).lower())
    return "\n".join(chunks)


def _criteria_terms(offer: dict) -> list:
    source = " ".join(
        [
            offer["title"],
            offer["serviceDescription"],
            offer["scope"],
            offer["deliverables"],
            offer["acceptanceCriteria"],
            offer["referenceUrls"],
        ]
    ).lower()
    terms = []
    known_terms = [
        "mochi-game",
        "mochi",
        "quest evaluator",
        "genlayer consensus",
        "demo autofill",
        "github",
        "readme",
        "live app",
    ]
    for term in known_terms:
        if term in source and term not in terms:
            terms.append(term)
    if len(terms) == 0:
        for raw in source.replace("\n", " ").replace(",", " ").replace(".", " ").split(" "):
            word = raw.strip()
            if len(word) >= 6 and word not in terms and not word.startswith("http"):
                terms.append(word)
            if len(terms) >= 8:
                break
    return terms


def _evidence_summary(evidence: dict, matched: list) -> str:
    labels = []
    for page in evidence["pages"]:
        if page["accessible"]:
            labels.append(page["label"])
    label_text = ", ".join(labels) if labels else "no public pages"
    matched_text = ", ".join(matched) if matched else "no material terms"
    return f"Fetched {label_text}; matched {matched_text}."


def _clause_prompt(source: dict) -> str:
    return f"""
You are ClauseFlow's GenLayer contract drafter.
Turn the Builder's offer into a serious, ready-to-accept work agreement.
This draft becomes the exact on-chain agreement a Client accepts and funds.

Return JSON only with these keys:
scope: one concrete paragraph
deliverables: newline-separated bullet list
acceptanceCriteria: newline-separated bullet list with objective checks
milestones: newline-separated bullet list, or empty if not useful
evidenceRequirements: newline-separated bullet list of public evidence URLs/artifacts the Builder must submit
verificationPlan: newline-separated bullet list describing how validators should check the evidence
deadline: human-readable deadline clause
revisionRules: human-readable revision clause
paymentTerms: human-readable payment clause using the GEN display amount, not only raw attoGEN
refundConditions: human-readable refund clause
summary: short agreement summary
sourceCoverage: COMPLETE or INCOMPLETE
scopeSpecific: true/false
deliverablesTestable: true/false
criteriaObjective: true/false
missingMaterialTerms: concise missing terms, empty if complete

Builder offer source:
{json.dumps(source, sort_keys=True)}

Drafting rules:
- Do not invent unrelated work beyond the source.
- Preserve the source scope. Do not add new code changes, audits, PRs, commits, reviewer checklists, delivery notes, or documentation obligations unless the source explicitly asks for them.
- Acceptance criteria must be direct, objective rewrites of the source criteria; do not make them stricter than the Builder's offer.
- If the source asks only to verify existing public evidence, draft a verification agreement only. Do not turn it into an implementation contract.
- Keep every deliverable testable from public links, screenshots, docs, repo code, or deployed app behavior.
- Mention exact payment as {source["priceDisplay"]} GEN.
- Use raw attoGEN only as technical metadata if needed, never as the primary payment wording.
- Require public GitHub/live/docs evidence when the source asks for a web app or dApp, but do not require evidence artifacts that were not part of the source.
- Reject vague acceptance criteria by marking sourceCoverage INCOMPLETE and listing missingMaterialTerms.
"""


def _normalize_structured_clauses(value, source: dict) -> dict:
    if not isinstance(value, dict):
        raise gl.vm.UserError("[LLM_ERROR] Clause draft returned non-object")
    source_coverage = _clean(value.get("sourceCoverage", "COMPLETE")).upper()
    if source_coverage not in ["COMPLETE", "INCOMPLETE"]:
        source_coverage = "INCOMPLETE"
    structured = {
        "scope": _fallback_text(value.get("scope"), source["scope"], 900),
        "deliverables": _fallback_text(value.get("deliverables"), source["deliverables"], 1200),
        "acceptanceCriteria": _fallback_text(value.get("acceptanceCriteria"), source["acceptanceCriteria"], 1400),
        "milestones": _clean_limit(value.get("milestones", ""), 900),
        "evidenceRequirements": _fallback_text(value.get("evidenceRequirements"), "Public delivery URL, GitHub repository, documentation URL, and optional demo URL.", 1000),
        "verificationPlan": _fallback_text(value.get("verificationPlan"), "Validators fetch each public evidence URL and compare visible content, repo/docs, and delivery notes against the accepted criteria.", 1200),
        "deadline": _fallback_text(value.get("deadline"), f"{source['deadlineDays']} day(s) after funding plus a {source['gracePeriodHours']} hour grace period.", 500),
        "revisionRules": _fallback_text(value.get("revisionRules"), f"Maximum {source['revisionRounds']} revision round(s), each within {source['revisionWindowHours']} hour(s).", 500),
        "paymentTerms": _fallback_text(value.get("paymentTerms"), f"Release {source['priceDisplay']} GEN after an APPROVED evidence review.", 500),
        "refundConditions": _fallback_text(value.get("refundConditions"), source["refundRule"], 700),
        "summary": _fallback_text(value.get("summary"), source["serviceDescription"], 450),
        "sourceCoverage": source_coverage,
        "scopeSpecific": _as_bool(value.get("scopeSpecific")),
        "deliverablesTestable": _as_bool(value.get("deliverablesTestable")),
        "criteriaObjective": _as_bool(value.get("criteriaObjective")),
        "missingMaterialTerms": _clean_limit(value.get("missingMaterialTerms", ""), 500),
        "priceDisplay": source["priceDisplay"],
        "priceAttoGen": source["priceAttoGen"],
    }
    if source["priceDisplay"].lower() not in structured["paymentTerms"].lower():
        structured["paymentTerms"] = f"Release {source['priceDisplay']} GEN after an APPROVED evidence review."
    return structured


def _structured_clauses_materially_valid(leader: dict, source: dict) -> bool:
    if not isinstance(leader, dict):
        return False
    if str(leader.get("priceAttoGen", "")) != source["priceAttoGen"]:
        return False
    if source["priceDisplay"].lower() not in _clean(leader.get("paymentTerms", "")).lower():
        return False
    if leader.get("sourceCoverage") != "COMPLETE":
        return False
    if not leader.get("scopeSpecific") or not leader.get("deliverablesTestable") or not leader.get("criteriaObjective"):
        return False
    return (
        len(_clean(leader.get("scope", ""))) >= 40
        and len(_clean(leader.get("deliverables", ""))) >= 40
        and len(_clean(leader.get("acceptanceCriteria", ""))) >= 40
        and len(_clean(leader.get("evidenceRequirements", ""))) >= 30
        and len(_clean(leader.get("verificationPlan", ""))) >= 30
        and len(_clean(leader.get("paymentTerms", ""))) >= 20
        and len(_clean(leader.get("refundConditions", ""))) >= 20
    )


def _review_prompt(offer: dict, deal: dict, evidence: dict) -> str:
    return f"""
You are ClauseFlow's GenLayer agreement reviewer.
Evaluate the Builder delivery against the exact accepted offer clauses and fetched evidence.
This is settlement-critical: approval releases escrowed GEN, rejection/refund returns value.

Return JSON only with these keys:
result: APPROVED, REVISION_REQUIRED, or REJECTED
score: integer 0-100
reason: concise reason grounded in evidence
checklist: concise missing/fix items, empty if approved
nextAction: what Builder or Client should do next
criteriaSatisfied: integer count
criteriaTotal: integer count
evidenceSummary: concise evidence found
criteriaResults: newline-separated list of each material criterion and PASS/PARTIAL/FAIL
missingItems: newline-separated concrete fixes, empty if approved

Accepted offer:
{json.dumps(offer, sort_keys=True)}

Submitted deal:
{json.dumps(deal, sort_keys=True)}

Fetched evidence:
{json.dumps(evidence, sort_keys=True)}

Rules:
- Approve only if fetched evidence materially supports the accepted scope, deliverables, and acceptance criteria.
- Prefer REVISION_REQUIRED for close but incomplete work.
- Use REJECTED for inaccessible, unrelated, or clearly failing evidence.
- Do not approve just because the delivery note claims completion.
- Treat public GitHub, live app, docs, demo pages, and visible content as evidence.
- If a criterion cannot be verified from fetched evidence, mark it PARTIAL or FAIL.
"""


def _normalize_review(value, evidence: dict) -> dict:
    if not isinstance(value, dict):
        raise gl.vm.UserError("[LLM_ERROR] Review returned non-object")
    raw = _clean(value.get("result", "REVISION_REQUIRED")).upper()
    if raw not in [STATUS_APPROVED, STATUS_REVISION_REQUIRED, STATUS_REJECTED]:
        raw = STATUS_REVISION_REQUIRED
    if int(evidence["accessibleCount"]) == 0:
        raw = STATUS_REJECTED
    score = _bounded_int(value.get("score", 0))
    return {
        "result": raw,
        "score": str(score),
        "reason": _clean(value.get("reason", "")),
        "checklist": _clean(value.get("checklist", "")),
        "nextAction": _clean(value.get("nextAction", "")),
        "criteriaSatisfied": str(_bounded_int(value.get("criteriaSatisfied", 0))),
        "criteriaTotal": str(_bounded_int(value.get("criteriaTotal", 0))),
        "evidenceSummary": _clean(value.get("evidenceSummary", "")),
        "criteriaResults": _clean_limit(value.get("criteriaResults", ""), 1400),
        "missingItems": _clean_limit(value.get("missingItems", value.get("checklist", "")), 1000),
        "accessibleCount": str(evidence["accessibleCount"]),
    }


def _review_history_note(review: dict) -> str:
    result = str(review["result"]).replace("_", " ")
    score = str(review["score"])
    reason = _clean_limit(review["reason"], 240)
    evidence = _clean_limit(review["evidenceSummary"], 240)
    missing = _clean_limit(review["missingItems"], 240)
    if missing:
        return f"{result} with score {score}. {reason} Evidence: {evidence} Missing: {missing}"
    return f"{result} with score {score}. {reason} Evidence: {evidence}"


def _clean(value) -> str:
    return str(value).strip()


def _clean_limit(value, limit: int) -> str:
    return _clean(value)[:limit]


def _fallback_text(value, fallback: str, limit: int) -> str:
    cleaned = _clean_limit(value, limit)
    if len(cleaned) == 0:
        return _clean_limit(fallback, limit)
    return cleaned


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return _clean(value).lower() in ["true", "yes", "1", "complete"]


def _format_gen(value) -> str:
    amount = int(value)
    whole = amount // 10**18
    fraction = str(amount % 10**18).rjust(18, "0").rstrip("0")
    if len(fraction) == 0:
        return str(whole)
    return f"{whole}.{fraction}"


def _bounded_int(value) -> int:
    try:
        number = int(value)
    except Exception:
        return 0
    if number < 0:
        return 0
    if number > 100:
        return 100
    return number


def _draft_matches_offer(
    draft: dict,
    title: str,
    service_description: str,
    scope: str,
    deliverables: str,
    acceptance_criteria: str,
    price_atto_gen: u256,
    deadline_days: u256,
    revision_rounds: u256,
    revision_window_hours: u256,
    grace_period_hours: u256,
    refund_rule: str,
) -> bool:
    return (
        draft["title"] == title
        and draft["serviceDescription"] == service_description
        and draft["scope"] == scope
        and draft["deliverables"] == deliverables
        and draft["acceptanceCriteria"] == acceptance_criteria
        and draft["priceAttoGen"] == str(price_atto_gen)
        and draft["deadlineDays"] == str(deadline_days)
        and draft["revisionRounds"] == str(revision_rounds)
        and draft["revisionWindowHours"] == str(revision_window_hours)
        and draft["gracePeriodHours"] == str(grace_period_hours)
        and draft["refundRule"] == refund_rule
    )


def _review_result_materially_valid(leader: dict, evidence: dict) -> bool:
    if not isinstance(leader, dict):
        return False
    result = str(leader.get("result", ""))
    if result not in [STATUS_APPROVED, STATUS_REVISION_REQUIRED, STATUS_REJECTED]:
        return False
    if str(leader.get("accessibleCount", "")) != str(evidence["accessibleCount"]):
        return False
    accessible_count = int(evidence["accessibleCount"])
    score = _bounded_int(leader.get("score", 0))
    criteria_satisfied = _bounded_int(leader.get("criteriaSatisfied", 0))
    criteria_total = _bounded_int(leader.get("criteriaTotal", 0))
    reason = _clean(leader.get("reason", ""))
    evidence_summary = _clean(leader.get("evidenceSummary", ""))
    criteria_results = _clean(leader.get("criteriaResults", ""))
    missing_items = _clean(leader.get("missingItems", ""))
    if len(reason) < 20 or len(evidence_summary) < 20 or len(criteria_results) < 20:
        return False
    if accessible_count == 0:
        return result == STATUS_REJECTED and score <= 60 and criteria_satisfied == 0 and len(missing_items) > 0
    if criteria_total == 0 or criteria_satisfied > criteria_total:
        return False
    if result == STATUS_APPROVED:
        return score >= 75 and criteria_satisfied > 0 and criteria_satisfied >= criteria_total and len(missing_items) == 0
    if result == STATUS_REJECTED:
        return score <= 70 and (criteria_satisfied == 0 or len(missing_items) > 0)
    return score < 90 and criteria_satisfied < criteria_total and len(missing_items) > 0


def _review_results_compatible(leader: dict, validator: dict) -> bool:
    if not isinstance(leader, dict) or not isinstance(validator, dict):
        return False
    return (
        leader["result"] == validator["result"]
        and leader["score"] == validator["score"]
        and leader["criteriaSatisfied"] == validator["criteriaSatisfied"]
        and leader["criteriaTotal"] == validator["criteriaTotal"]
        and leader["accessibleCount"] == validator["accessibleCount"]
    )
