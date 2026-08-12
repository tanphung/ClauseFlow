import copy
import json
from pathlib import Path
import sys


PRICE = 20_000_000_000_000_000
BUILDER_INPUTS = (
    "Audit and polish Mochi-Game Quest Evaluator demo flow",
    "Review the public Mochi-Game dApp and make the Quest Evaluator reviewer path clear.",
    "Inspect the live Mochi-Game app and GitHub README, then deliver a reviewer-ready Quest Evaluator evidence package.",
    "Public live app URL, GitHub repository, README evidence, and a delivery note explaining the Quest Evaluator flow.",
    "Validators can fetch the live app and GitHub README and confirm the Quest Evaluator purpose, GenLayer consensus usage, and reviewer demo checklist.",
)


def _wallet(address) -> str:
    if isinstance(address, (bytes, bytearray)):
        return "0x" + bytes(address).hex()
    if hasattr(address, "as_hex"):
        return address.as_hex
    return str(address)


def _structure(contract, vm, builder) -> dict:
    vm.sender = builder
    vm.value = 0
    vm.clear_mocks()
    result = json.loads(contract.structure_offer(
        *BUILDER_INPUTS,
        PRICE,
        3,
        1,
        24,
        24,
        "Refund after deadline plus grace period if no valid delivery exists.",
    ))
    assert result["scopeSpecific"] is True
    assert result["deliverablesTestable"] is True
    assert result["criteriaObjective"] is True
    assert result["missingMaterialTerms"] == ""
    return result


def _publish(contract, vm, builder) -> str:
    _structure(contract, vm, builder)
    vm.sender = builder
    return contract.publish_offer(
        *BUILDER_INPUTS,
        PRICE,
        3,
        1,
        24,
        24,
        "Refund after deadline plus grace period if no valid delivery exists.",
        "https://github.com/tanphung/Mochi-Game\nhttps://mochi-game-frontend.vercel.app",
    )


def _fund(contract, vm, builder, client) -> str:
    offer_id = _publish(contract, vm, builder)
    vm.sender = client
    vm.value = PRICE
    deal_id = contract.accept_offer(offer_id)
    vm.value = 0
    return deal_id


def _submit_and_review(contract, vm, builder, deal_id: str, result: str, validator_status: str = "") -> dict:
    vm.sender = builder
    approved = result == "APPROVED"
    revision = result == "REVISION_REQUIRED"
    has_relevant_evidence = approved or revision
    contract.submit_delivery(
        deal_id,
        "https://mochi-game-frontend.vercel.app" if has_relevant_evidence else "https://invalid.example/evidence",
        "https://github.com/tanphung/Mochi-Game" if has_relevant_evidence else "",
        "https://mochi-game-frontend.vercel.app" if has_relevant_evidence else "",
        "https://github.com/tanphung/Mochi-Game#readme" if has_relevant_evidence else "",
        "Delivered a public Mochi-Game Quest Evaluator evidence package." if has_relevant_evidence else "Submitted unrelated evidence.",
    )
    vm.clear_mocks()
    body = "Mochi-Game Mochi Quest Evaluator GenLayer consensus demo autofill GitHub README live app evidence." if has_relevant_evidence else "Unrelated landing page with no accepted evidence."
    vm.mock_web(r".*", {"status": 200, "body": body})
    criterion_status = "SATISFIED" if has_relevant_evidence else "NOT_SATISFIED"
    deliverable_status = "SATISFIED" if approved else "PARTIAL" if revision else "NOT_SATISFIED"
    evidence_urls = ["https://mochi-game-frontend.vercel.app"] if has_relevant_evidence else ["https://invalid.example/evidence"]
    executive_summary = (
        "The fetched live application and repository directly demonstrate the accepted Quest Evaluator workflow and its GenLayer integration. "
        "Each accepted obligation is supported by public, independently retrievable evidence."
    ) if approved else (
        "The public application proves the core Quest Evaluator criterion, but the submitted artifact package is incomplete. "
        "A corrected evidence package can resolve the documented deliverable gap."
    ) if revision else (
        "The submitted public page is unrelated to the accepted Quest Evaluator work and provides no verifiable implementation evidence. "
        "The accepted obligations therefore cannot be settled in the Builder's favor."
    )
    vm.mock_llm(
        r"independent GenLayer settlement validator for ClauseFlow",
        json.dumps({
            "executiveSummary": executive_summary,
            "criterionAssessments": [{
                "id": "C1",
                "status": criterion_status,
                "finding": "The public evidence demonstrates the complete accepted reviewer workflow." if has_relevant_evidence else "The page does not demonstrate the accepted reviewer workflow.",
                "reasoning": "The live interface and repository documentation expose the required behavior and transaction states." if has_relevant_evidence else "No observable application behavior, repository artifact, or documentation supports the accepted criterion.",
                "evidenceUrls": evidence_urls,
            }],
            "deliverableAssessments": [{
                "id": "D1",
                "status": deliverable_status,
                "finding": "All requested public evidence artifacts are present and mutually consistent." if approved else "The core app is present, but the final reviewer note remains incomplete." if revision else "The required live app, repository, README, and reviewer note are absent.",
                "reasoning": "Validators can independently retrieve and cross-check each submitted artifact." if approved else "The fetched sources prove part of the package but not the complete contracted handoff." if revision else "The single unrelated page cannot establish delivery of any contracted artifact.",
                "evidenceUrls": evidence_urls,
            }],
            "sourceAssessments": [
                {"label": "delivery", "finding": "Fetched public delivery evidence.", "relevance": "Directly addresses the accepted work." if approved else "Unrelated to the accepted work."},
                {"label": "demo", "finding": "Fetched demo evidence.", "relevance": "Shows the reviewer workflow." if approved else "No demo was supplied."},
                {"label": "documentation", "finding": "Fetched documentation evidence.", "relevance": "Explains the GenLayer flow." if approved else "No documentation was supplied."},
                {"label": "github", "finding": "Fetched repository evidence.", "relevance": "Corroborates the implementation." if approved else "No repository was supplied."},
            ],
            "strengths": ["Public artifacts are independently retrievable."] if has_relevant_evidence else [],
            "risks": [] if approved else ["The final evidence package is incomplete."] if revision else ["No accepted deliverable can be verified."],
            "missingItems": [] if approved else ["Submit the contracted live app, repository, and documentation evidence."],
            "nextAction": "Builder can claim payment." if approved else "Builder should submit the documented correction." if revision else "Client can claim a refund under the accepted agreement.",
        }),
    )
    verification_supported = not validator_status
    vm.mock_llm(
        r"independent GenLayer settlement report verifier",
        json.dumps({
            "sourceAccessibilitySupported": verification_supported,
            "criteriaCoverageSupported": verification_supported,
            "deliverableCoverageSupported": verification_supported,
            "missingItemsSupported": verification_supported,
            "scoreSupported": verification_supported,
            "decisionSupported": verification_supported,
            "unsupportedClaims": [] if verification_supported else ["Independent evidence does not support the leader decision."],
        }),
    )
    return json.loads(contract.review_delivery(deal_id))


def test_publish_requires_contract_draft(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/clauseflow.py")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Structure and review"):
        contract.publish_offer(
            *BUILDER_INPUTS, PRICE, 1, 1, 24, 24,
            "Refund after deadline plus grace period if no valid delivery exists.",
            "https://github.com/tanphung/Mochi-Game",
        )


def test_structured_draft_is_material_and_bound_to_source(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/clauseflow.py")
    clauses = _structure(contract, direct_vm, direct_alice)
    assert clauses["deadline"] == "3 day(s) after funding plus a 24 hour grace period."
    assert clauses["paymentTerms"] == "Release 0.02 GEN after an APPROVED evidence review."
    assert "attoGEN" not in clauses["paymentTerms"]
    assert "Mochi-Game" in clauses["scope"]
    draft = json.loads(contract.get_structured_offer(_wallet(direct_alice)))
    assert draft["clauses"] == clauses
    with direct_vm.expect_revert("fields changed after structuring"):
        contract.publish_offer(
            BUILDER_INPUTS[0] + " changed", *BUILDER_INPUTS[1:], PRICE, 1, 1, 24, 24,
            "Refund after deadline plus grace period if no valid delivery exists.",
            "https://github.com/tanphung/Mochi-Game",
        )


def test_structuring_does_not_depend_on_llm_output(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/clauseflow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.mock_llm(
        r".*",
        json.dumps({"sourceCoverage": "INCOMPLETE", "missingMaterialTerms": "Invented LLM requirement."}),
    )
    clauses = json.loads(contract.structure_offer(
        *BUILDER_INPUTS,
        PRICE,
        3,
        1,
        24,
        24,
        "Refund after deadline plus grace period if no valid delivery exists.",
    ))
    assert clauses["sourceCoverage"] == "COMPLETE"
    assert clauses["missingMaterialTerms"] == ""
    assert clauses["scope"] == BUILDER_INPUTS[2]
    stored = json.loads(contract.get_structured_offer(_wallet(direct_alice)))
    assert stored["clauses"] == clauses


def test_exact_funding_history_and_address_views(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/clauseflow.py")
    offer_id = _publish(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = PRICE - 1
    with direct_vm.expect_revert("amount must match"):
        contract.accept_offer(offer_id)
    direct_vm.value = PRICE
    deal_id = contract.accept_offer(offer_id)
    deal = json.loads(contract.get_deal(deal_id))
    assert deal["status"] == "FUNDED"
    assert json.loads(contract.get_deals_for_address(_wallet(direct_alice))) == [deal_id]
    assert json.loads(contract.get_deals_for_address(_wallet(direct_bob))) == [deal_id]
    assert json.loads(contract.get_deal_history(deal_id))[0]["eventType"] == "FUNDED"
    assert json.loads(contract.get_dashboard_stats())["accountedEscrowAtto"] == str(PRICE)


def test_only_builder_can_submit_and_approved_payment_is_idempotent(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/clauseflow.py")
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the builder"):
        contract.submit_delivery(deal_id, "https://mochi-game-frontend.vercel.app", "", "", "", "Not builder")
    review = _submit_and_review(contract, direct_vm, direct_alice, deal_id, "APPROVED")
    assert review["result"] == "APPROVED"
    assert review["score"] == "100"
    assert review["criterionAssessments"][0]["status"] == "SATISFIED"
    assert "contains '" not in review["criteriaResults"]
    assert len(json.dumps(review, sort_keys=True)) < 8_000
    stored = json.loads(contract.get_deal(deal_id))
    assert json.loads(stored["reviewCriterionAssessments"])[0]["reasoning"].startswith("The live interface")
    assert "independently fetched" in stored["reviewConsensusBasis"]
    assert "Valid JSON or matching prose alone was insufficient" in stored["reviewConsensusBasis"]
    assert len(stored["reviewExecutiveSummary"]) <= 720
    assert len(json.loads(stored["reviewSourceAssessments"])[0]["finding"]) <= 260
    direct_vm.sender = direct_alice
    contract.claim_payment(deal_id)
    assert json.loads(contract.get_deal(deal_id))["status"] == "PAYMENT_PENDING"
    with direct_vm.expect_revert("approved before payment"):
        contract.claim_payment(deal_id)


def test_rejected_deal_refunds_client_and_does_not_block_other_settlement(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/clauseflow.py")
    first = _fund(contract, direct_vm, direct_alice, direct_bob)
    rejected = _submit_and_review(contract, direct_vm, direct_alice, first, "REJECTED")
    assert rejected["result"] == "REJECTED"
    assert rejected["criterionAssessments"][0]["status"] == "NOT_SATISFIED"
    assert rejected["missingItems"]
    direct_vm.sender = direct_bob
    contract.claim_refund(first)
    assert json.loads(contract.get_deal(first))["status"] == "REFUND_PENDING"

    second = _fund(contract, direct_vm, direct_alice, direct_bob)
    _submit_and_review(contract, direct_vm, direct_alice, second, "APPROVED")
    direct_vm.sender = direct_alice
    contract.claim_payment(second)
    assert json.loads(contract.get_deal(second))["status"] == "PAYMENT_PENDING"
    assert json.loads(contract.get_dashboard_stats())["accountedEscrowAtto"] == "0"


def test_one_revision_round_allows_one_corrected_submission(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/clauseflow.py")
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    review = _submit_and_review(contract, direct_vm, direct_alice, deal_id, "REVISION_REQUIRED")
    assert review["result"] == "REVISION_REQUIRED"
    assert review["score"] == "75"
    deal = json.loads(contract.get_deal(deal_id))
    assert deal["status"] == "REVISION_REQUIRED"
    assert deal["revisionCount"] == "1"
    direct_vm.sender = direct_alice
    contract.submit_delivery(
        deal_id,
        "https://mochi-game-frontend.vercel.app",
        "https://github.com/tanphung/Mochi-Game",
        "",
        "https://github.com/tanphung/Mochi-Game#readme",
        "Corrected evidence package for the allowed revision round.",
    )
    assert json.loads(contract.get_deal(deal_id))["status"] == "SUBMITTED"


def test_material_verifier_requires_every_supported_field(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/clauseflow.py")
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    leader = _submit_and_review(contract, direct_vm, direct_alice, deal_id, "APPROVED")
    module = sys.modules[type(contract._instance).__module__]

    evidence = {"accessibleCount": leader["accessibleCount"]}
    verification = {
        "sourceAccessibilitySupported": True,
        "criteriaCoverageSupported": True,
        "deliverableCoverageSupported": True,
        "missingItemsSupported": True,
        "scoreSupported": True,
        "decisionSupported": True,
        "unsupportedClaims": [],
    }
    assert module._verification_accepts_report(leader, verification, evidence) is True
    for key in ["sourceAccessibilitySupported", "criteriaCoverageSupported", "deliverableCoverageSupported", "missingItemsSupported", "scoreSupported", "decisionSupported"]:
        disagreement = copy.deepcopy(verification)
        disagreement[key] = False
        assert module._verification_accepts_report(leader, disagreement, evidence) is False
    unsupported = copy.deepcopy(verification)
    unsupported["unsupportedClaims"] = ["The cited source does not prove D1."]
    assert module._verification_accepts_report(leader, unsupported, evidence) is False
    changed_accessibility = {"accessibleCount": str(int(leader["accessibleCount"]) - 1)}
    assert module._verification_accepts_report(leader, verification, changed_accessibility) is False


def test_contract_source_excerpt_is_compact_and_material(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/clauseflow.py")
    module = sys.modules[type(contract._instance).__module__]
    source = Path("contracts/clauseflow.py").read_text(encoding="utf-8")
    excerpt = module._evidence_excerpt(source, "https://example.test/contracts/clauseflow.py")
    assert len(excerpt) <= 1800
    for term in [
        "_review_prompt",
        "_review_verification_prompt",
        "Treat the leader report as an untrusted claim",
        "actual observable artifacts",
        "_verification_accepts_report",
        "evidenceUrls",
        'result, score, satisfied = _derive_material_outcome',
        '_bounded_int(review.get("score"',
        'if not all(verification.get(key) is True for key in required)',
        'unsupported = verification.get("unsupportedClaims"',
    ]:
        assert term in excerpt


def test_missing_validator_narrative_is_not_filled_or_accepted(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/clauseflow.py")
    module = sys.modules[type(contract._instance).__module__]
    evidence = {
        "accessibleCount": "1",
        "deliveryNote": "Public evidence submitted.",
        "pages": [{"label": "delivery", "url": "https://example.test/evidence", "accessible": True, "content": "observable artifact"}],
    }
    raw = {
        "executiveSummary": "",
        "criterionAssessments": [{"status": "SATISFIED", "finding": "", "reasoning": "", "evidenceUrls": ["https://example.test/evidence"]}],
        "deliverableAssessments": [{"status": "SATISFIED", "finding": "", "reasoning": "", "evidenceUrls": ["https://example.test/evidence"]}],
        "sourceAssessments": [{"finding": "", "relevance": ""}],
        "missingItems": [],
    }
    review = module._normalize_review(raw, evidence, ["Observable acceptance criterion"], ["Observable delivery artifact"])
    assert review["executiveSummary"] == ""
    assert review["criterionAssessments"][0]["finding"] == ""
    assert review["criterionAssessments"][0]["reasoning"] == ""
    assert review["sourceAssessments"][0]["finding"] == ""
    assert review["sourceAssessments"][0]["relevance"] == ""
    assert module._review_result_materially_valid(review) is False
