import hashlib
import json
import sys


ROUTER = "0x" + "9" * 40
PRICE = 20_000_000_000_000_000
COMMIT = "a" * 40
BODY = "ClauseFlow v2 immutable release dossier with obligation evidence and settlement receipt."

OBLIGATIONS = [
    {
        "id": "O_SCOPE",
        "category": "SCOPE",
        "statement": "Publish the complete ClauseFlow v2 agreement workflow.",
        "acceptanceRule": "The immutable source visibly contains the complete v2 workflow.",
        "requiredEvidenceTypes": ["SOURCE"],
    },
    {
        "id": "O_DOCS",
        "category": "DELIVERABLE",
        "statement": "Deliver a reviewer-facing method and policy dossier.",
        "acceptanceRule": "The immutable documentation explains obligations, revisions, refunds, and receipts.",
        "requiredEvidenceTypes": ["DOCUMENTATION"],
    },
    {
        "id": "O_RELEASE",
        "category": "ACCEPTANCE",
        "statement": "Provide an immutable public release artifact for independent review.",
        "acceptanceRule": "Validators can fetch the artifact and match its stored SHA-256 digest.",
        "requiredEvidenceTypes": ["DELIVERY"],
    },
]


def _wallet(address) -> str:
    if isinstance(address, (bytes, bytearray)):
        return "0x" + bytes(address).hex()
    if hasattr(address, "as_hex"):
        return address.as_hex
    return str(address)


def _deploy(direct_deploy):
    return direct_deploy("contracts/clauseflow.py", ROUTER)


def _terms_args(obligations=None, revisions=1, revision_window=24, review_window=24):
    return (
        "ClauseFlow v2 evidence release",
        "A bounded service agreement whose every accepted obligation is independently adjudicated.",
        json.dumps(obligations or OBLIGATIONS),
        PRICE,
        48,
        24,
        revisions,
        revision_window,
        review_window,
    )


def _publish(contract, vm, builder, **kwargs):
    vm.sender = builder
    vm.value = 0
    args = _terms_args(**kwargs)
    structured = json.loads(contract.structure_offer(*args))
    assert structured["protocolVersion"] == "CLAUSEFLOW_V2"
    return contract.publish_offer(*args)


def _fund(contract, vm, builder, client, **kwargs):
    offer_id = _publish(contract, vm, builder, **kwargs)
    vm.sender = client
    vm.value = PRICE
    deal_id = contract.accept_offer(offer_id)
    vm.value = 0
    return deal_id


def _source(source_id, evidence_type, suffix):
    return {
        "id": source_id,
        "type": evidence_type,
        "label": evidence_type.title() + " evidence",
        "url": f"https://raw.githubusercontent.com/example/clauseflow/{COMMIT}/{suffix}.md",
        "versionKind": "GIT_COMMIT",
        "versionId": COMMIT,
        "sha256": hashlib.sha256(BODY.encode()).hexdigest(),
    }


def _manifest(include_all=True, wrong_hash=False):
    sources = [
        _source("E_SOURCE", "SOURCE", "source"),
        _source("E_DOCS", "DOCUMENTATION", "docs"),
    ]
    if include_all:
        sources.append(_source("E_RELEASE", "DELIVERY", "release"))
    if wrong_hash:
        sources[0]["sha256"] = "0" * 64
    return sources


def _submit(contract, vm, builder, deal_id, manifest=None):
    vm.sender = builder
    contract.submit_delivery(
        deal_id,
        json.dumps(manifest or _manifest()),
        "Submitted commit-pinned artifacts with hashes for every accepted obligation.",
    )


def _mock_review(vm, statuses, decision):
    vm.clear_mocks()
    vm.mock_web(r".*raw\.githubusercontent\.com.*", {"status": 200, "body": BODY})
    assessments = []
    evidence_ids = ["E_SOURCE", "E_DOCS", "E_RELEASE"]
    for index, obligation in enumerate(OBLIGATIONS):
        assessments.append({
            "obligationId": obligation["id"],
            "status": statuses[index],
            "finding": "The immutable artifact provides observable evidence for this accepted obligation.",
            "reasoning": "The fetched commit-pinned content matches its SHA-256 and directly satisfies the stored acceptance rule.",
            "evidenceIds": [evidence_ids[index]],
        })
    vm.mock_llm(
        r"leader validator for a GenLayer escrow agreement",
        json.dumps({
            "executiveSummary": "Validators evaluated every accepted obligation against independently fetched immutable evidence.",
            "obligationAssessments": assessments,
            "strengths": ["Every artifact is commit-pinned and content-hashed."],
            "risks": [] if decision == "APPROVED" else ["At least one accepted obligation remains incomplete."],
            "missingItems": [] if decision == "APPROVED" else ["Correct the incomplete accepted obligation."],
            "revisionChecklist": [] if decision == "APPROVED" else ["Submit corrected immutable evidence."],
            "recommendedDecision": decision,
        }),
    )


class FakeRouter:
    released = False
    funded = []

    def __init__(self, address):
        self.address = address

    def emit(self, value=0):
        self.value = int(value)
        return self

    def fund_settlement(self, settlement_id, deal_id, recipient, kind):
        self.funded.append((settlement_id, deal_id, str(recipient), int(kind), self.value))

    def view(self):
        return self

    def matches_released(self, settlement_id, deal_id, recipient, amount, kind, source):
        return self.released


def test_constructor_and_protocol_policy(direct_deploy, direct_vm):
    contract = _deploy(direct_deploy)
    module = sys.modules[type(contract._instance).__module__]
    assert module._is_address("not-an-address") is False
    policy = json.loads(contract.get_protocol_policy())
    assert policy["protocolVersion"] == "CLAUSEFLOW_V2"
    assert policy["settlementRouter"].lower() == ROUTER.lower()
    assert policy["maxObligations"] == "12"


def test_offer_rejects_duplicate_or_silently_truncated_obligations(direct_deploy, direct_vm, direct_alice):
    contract = _deploy(direct_deploy)
    duplicate = OBLIGATIONS + [dict(OBLIGATIONS[0])]
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unique"):
        contract.structure_offer(*_terms_args(duplicate))
    too_many = []
    for index in range(13):
        too_many.append({
            "id": f"O{index}", "category": "SCOPE",
            "statement": f"Specific accepted obligation number {index} is delivered.",
            "acceptanceRule": f"Immutable evidence proves accepted obligation number {index}.",
            "requiredEvidenceTypes": ["SOURCE"],
        })
    with direct_vm.expect_revert("between 1 and 12"):
        contract.structure_offer(*_terms_args(too_many))


def test_structured_terms_are_hash_bound_and_exactly_funded(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    direct_vm.sender = direct_alice
    args = _terms_args()
    structured = json.loads(contract.structure_offer(*args))
    assert len(json.loads(structured["obligations"])) == 3
    with direct_vm.expect_revert("fields changed"):
        changed = list(args)
        changed[0] = "Changed agreement title"
        contract.publish_offer(*changed)
    offer_id = contract.publish_offer(*args)
    direct_vm.sender = direct_bob
    direct_vm.value = PRICE - 1
    with direct_vm.expect_revert("exactly"):
        contract.accept_offer(offer_id)
    direct_vm.value = PRICE
    deal_id = contract.accept_offer(offer_id)
    deal = json.loads(contract.get_deal(deal_id))
    assert deal["obligationsHash"] == structured["obligationsHash"]
    assert deal["status"] == "FUNDED"


def test_evidence_requires_immutable_version_and_appends_rounds(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    moving = _manifest()
    moving[0]["url"] = "https://raw.githubusercontent.com/example/clauseflow/main/source.md"
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("commit hash"):
        contract.submit_delivery(deal_id, json.dumps(moving), "This moving branch is not immutable evidence.")
    _submit(contract, direct_vm, direct_alice, deal_id)
    rounds = json.loads(contract.get_evidence_rounds(deal_id))
    assert len(rounds) == 1
    assert rounds[0]["manifestHash"] == json.loads(contract.get_deal(deal_id))["currentEvidenceHash"]


def test_approval_requires_every_obligation_and_matching_hash(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    _submit(contract, direct_vm, direct_alice, deal_id, _manifest(wrong_hash=True))
    _mock_review(direct_vm, ["SATISFIED", "SATISFIED", "SATISFIED"], "APPROVED")
    review = json.loads(contract.review_delivery(deal_id))
    assert review["result"] != "APPROVED"
    assert review["obligationAssessments"][0]["status"] == "UNVERIFIABLE"
    assert review["sourceAssessments"][0]["versionMatched"] is False


def test_all_obligations_approved_and_validator_rechecks_exact_ids(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    _submit(contract, direct_vm, direct_alice, deal_id)
    _mock_review(direct_vm, ["SATISFIED", "SATISFIED", "SATISFIED"], "APPROVED")
    review = json.loads(contract.review_delivery(deal_id))
    assert review["result"] == "APPROVED"
    assert review["score"] == "100"
    assert [item["obligationId"] for item in review["obligationAssessments"]] == [item["id"] for item in OBLIGATIONS]
    assert "independently refetched" in review["consensusBasis"]

    module = sys.modules[type(contract._instance).__module__]
    evidence = module._fetch_evidence(_manifest())
    verification = {
        "obligationSupport": [{"obligationId": item["id"], "supported": True} for item in OBLIGATIONS],
        "sourceAccessibilitySupported": True,
        "versionBindingSupported": True,
        "scoreSupported": True,
        "decisionSupported": True,
        "unsupportedClaims": [],
    }
    assert module._verification_accepts_report(review, verification, evidence, OBLIGATIONS) is True
    verification["obligationSupport"] = verification["obligationSupport"][:-1]
    assert module._verification_accepts_report(review, verification, evidence, OBLIGATIONS) is False


def test_revision_window_and_review_timeout_enforce_refund(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    direct_vm.warp("2026-08-20T00:00:00Z")
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob, revisions=1, revision_window=2, review_window=1)
    _submit(contract, direct_vm, direct_alice, deal_id)
    _mock_review(direct_vm, ["SATISFIED", "PARTIAL", "SATISFIED"], "REVISION_REQUIRED")
    review = json.loads(contract.review_delivery(deal_id))
    assert review["result"] == "REVISION_REQUIRED"
    deal = json.loads(contract.get_deal(deal_id))
    assert deal["revisionCount"] == "1"
    direct_vm.warp("2026-08-20T03:00:01Z")
    eligibility = json.loads(contract.get_refund_eligibility(deal_id))
    assert eligibility["eligible"] is True
    assert "revision deadline" in eligibility["reason"]
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Revision window has expired"):
        contract.submit_delivery(deal_id, json.dumps(_manifest()), "Late corrected immutable evidence submission.")


def test_initial_deadline_and_submitted_review_timeout_are_refundable(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    direct_vm.warp("2026-08-20T00:00:00Z")
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.warp("2026-08-23T00:00:01Z")
    eligibility = json.loads(contract.get_refund_eligibility(deal_id))
    assert eligibility["eligible"] is True
    assert "grace" in eligibility["reason"]

    second = _fund(contract, direct_vm, direct_alice, direct_bob, review_window=1)
    _submit(contract, direct_vm, direct_alice, second)
    direct_vm.warp("2026-08-23T01:00:01Z")
    submitted = json.loads(contract.get_refund_eligibility(second))
    assert submitted["eligible"] is True
    assert "review timeout" in submitted["reason"]


def test_settlement_is_bound_to_specific_router_receipt(direct_deploy, direct_vm, direct_alice, direct_bob):
    contract = _deploy(direct_deploy)
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob)
    _submit(contract, direct_vm, direct_alice, deal_id)
    _mock_review(direct_vm, ["SATISFIED", "SATISFIED", "SATISFIED"], "APPROVED")
    contract.review_delivery(deal_id)
    module = sys.modules[type(contract._instance).__module__]
    FakeRouter.funded = []
    FakeRouter.released = False
    original = module.SettlementRouter
    module.SettlementRouter = FakeRouter
    try:
        direct_vm.sender = direct_alice
        contract.claim_payment(deal_id)
        pending = json.loads(contract.get_deal(deal_id))
        assert pending["status"] == "PAYMENT_PENDING"
        assert pending["settlementId"].startswith("CF2|")
        assert FakeRouter.funded[0][1] == deal_id
        assert FakeRouter.funded[0][4] == PRICE
        with direct_vm.expect_revert("no released receipt matching"):
            contract.confirm_payment(deal_id)
        FakeRouter.released = True
        contract.confirm_payment(deal_id)
        paid = json.loads(contract.get_deal(deal_id))
        assert paid["status"] == "PAID"
        assert paid["paid"] == "true"
        with direct_vm.expect_revert("awaiting confirmation"):
            contract.confirm_payment(deal_id)
    finally:
        module.SettlementRouter = original


def test_rejected_deal_routes_refund_only_to_client(direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie):
    contract = _deploy(direct_deploy)
    deal_id = _fund(contract, direct_vm, direct_alice, direct_bob, revisions=0, revision_window=0)
    _submit(contract, direct_vm, direct_alice, deal_id, _manifest(include_all=False))
    _mock_review(direct_vm, ["SATISFIED", "SATISFIED", "NOT_SATISFIED"], "REJECTED")
    review = json.loads(contract.review_delivery(deal_id))
    assert review["result"] == "REJECTED"
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the client"):
        contract.claim_refund(deal_id)
