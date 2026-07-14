import json


PRICE = 20_000_000_000_000_000
BUILDER_INPUTS = (
    "Build a verified public page",
    "Deliver a public page that validators can fetch.",
    "Provide a publicly accessible Example Domain page.",
    "A working HTTPS URL with visible Example Domain text.",
    "The URL is accessible and visibly contains Example Domain.",
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
    result = json.loads(contract.structure_offer(
        *BUILDER_INPUTS,
        PRICE,
        1,
        1,
        24,
        24,
        "Refund after deadline plus grace period if no valid delivery exists.",
    ))
    return result


def _publish(contract, vm, builder) -> str:
    _structure(contract, vm, builder)
    vm.sender = builder
    return contract.publish_offer(
        *BUILDER_INPUTS,
        PRICE,
        1,
        1,
        24,
        24,
        "Refund after deadline plus grace period if no valid delivery exists.",
        "https://example.com",
    )


def _fund(contract, vm, builder, client) -> str:
    offer_id = _publish(contract, vm, builder)
    vm.sender = client
    vm.value = PRICE
    deal_id = contract.accept_offer(offer_id)
    vm.value = 0
    return deal_id


def _submit_and_review(contract, vm, builder, deal_id: str, result: str) -> dict:
    vm.sender = builder
    contract.submit_delivery(
        deal_id,
        "https://example.com",
        "",
        "https://example.com",
        "https://www.iana.org/help/example-domains",
        "Delivered a public Example Domain page.",
    )
    vm.clear_mocks()
    vm.mock_web(r".*", {"status": 200, "body": "Example Domain verified public content."})
    score = 100 if result == "APPROVED" else 10
    vm.mock_llm(
        r"ClauseFlow's GenLayer agreement reviewer",
        json.dumps({
            "result": result,
            "score": score,
            "reason": "Fetched evidence was evaluated against accepted clauses.",
            "checklist": "Provide missing evidence." if result != "APPROVED" else "",
            "nextAction": "Settle the agreement.",
            "criteriaSatisfied": 3 if result == "APPROVED" else 0,
            "criteriaTotal": 3,
            "evidenceSummary": "Public evidence fetched.",
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
            "https://example.com",
        )


def test_structured_draft_is_material_and_bound_to_source(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/clauseflow.py")
    clauses = _structure(contract, direct_vm, direct_alice)
    assert clauses["deadline"] == "1 day(s) after funding plus a 24 hour grace period."
    assert clauses["paymentTerms"] == f"Release exactly {PRICE} attoGEN after an APPROVED evidence review."
    draft = json.loads(contract.get_structured_offer(_wallet(direct_alice)))
    assert draft["clauses"] == clauses
    with direct_vm.expect_revert("fields changed after structuring"):
        contract.publish_offer(
            BUILDER_INPUTS[0] + " changed", *BUILDER_INPUTS[1:], PRICE, 1, 1, 24, 24,
            "Refund after deadline plus grace period if no valid delivery exists.",
            "https://example.com",
        )


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
        contract.submit_delivery(deal_id, "https://example.com", "", "", "", "Not builder")
    review = _submit_and_review(contract, direct_vm, direct_alice, deal_id, "APPROVED")
    assert review["result"] == "APPROVED"
    direct_vm.sender = direct_alice
    contract.claim_payment(deal_id)
    assert json.loads(contract.get_deal(deal_id))["status"] == "PAYMENT_PENDING"
    with direct_vm.expect_revert("approved before payment"):
        contract.claim_payment(deal_id)


def test_rejected_deal_refunds_client_and_does_not_block_other_settlement(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/clauseflow.py")
    first = _fund(contract, direct_vm, direct_alice, direct_bob)
    _submit_and_review(contract, direct_vm, direct_alice, first, "REJECTED")
    direct_vm.sender = direct_bob
    contract.claim_refund(first)
    assert json.loads(contract.get_deal(first))["status"] == "REFUND_PENDING"

    second = _fund(contract, direct_vm, direct_alice, direct_bob)
    _submit_and_review(contract, direct_vm, direct_alice, second, "APPROVED")
    direct_vm.sender = direct_alice
    contract.claim_payment(second)
    assert json.loads(contract.get_deal(second))["status"] == "PAYMENT_PENDING"
    assert json.loads(contract.get_dashboard_stats())["accountedEscrowAtto"] == "0"
