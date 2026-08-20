// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ClauseFlowSettlementRouter {
    enum SettlementState {
        NONE,
        FUNDED,
        RELEASED
    }

    struct SettlementReceipt {
        address source;
        bytes32 dealHash;
        address payable recipient;
        uint256 amount;
        uint8 kind;
        SettlementState state;
    }

    address public immutable owner;
    address public clauseFlow;
    mapping(bytes32 => SettlementReceipt) private receipts;
    bool private releasing;

    event ClauseFlowBound(address indexed clauseFlow);
    event SettlementFunded(
        bytes32 indexed settlementKey,
        string settlementId,
        string dealId,
        address indexed recipient,
        uint256 amount,
        uint8 kind
    );
    event SettlementReleased(
        bytes32 indexed settlementKey,
        string settlementId,
        address indexed recipient,
        uint256 amount
    );

    error Unauthorized();
    error AlreadyBound();
    error InvalidSettlement();
    error SettlementExists();
    error NotRecipient();
    error NotFunded();
    error TransferFailed();
    error ReentrantCall();

    constructor() {
        owner = msg.sender;
    }

    function bind_clauseflow(address clauseFlowAddress) external {
        if (msg.sender != owner) revert Unauthorized();
        if (clauseFlow != address(0)) revert AlreadyBound();
        if (clauseFlowAddress == address(0)) revert InvalidSettlement();
        clauseFlow = clauseFlowAddress;
        emit ClauseFlowBound(clauseFlowAddress);
    }

    function fund_settlement(
        string calldata settlementId,
        string calldata dealId,
        address payable recipient,
        uint8 kind
    ) external payable {
        if (msg.sender != clauseFlow || clauseFlow == address(0)) revert Unauthorized();
        if (bytes(settlementId).length == 0 || bytes(dealId).length == 0 || recipient == address(0)) {
            revert InvalidSettlement();
        }
        if (msg.value == 0 || (kind != 1 && kind != 2)) revert InvalidSettlement();

        bytes32 key = keccak256(bytes(settlementId));
        if (receipts[key].state != SettlementState.NONE) revert SettlementExists();
        receipts[key] = SettlementReceipt({
            source: msg.sender,
            dealHash: keccak256(bytes(dealId)),
            recipient: recipient,
            amount: msg.value,
            kind: kind,
            state: SettlementState.FUNDED
        });
        emit SettlementFunded(key, settlementId, dealId, recipient, msg.value, kind);
    }

    function release_settlement(string calldata settlementId) external {
        if (releasing) revert ReentrantCall();
        bytes32 key = keccak256(bytes(settlementId));
        SettlementReceipt storage receipt = receipts[key];
        if (receipt.state != SettlementState.FUNDED) revert NotFunded();
        if (msg.sender != receipt.recipient) revert NotRecipient();

        releasing = true;
        receipt.state = SettlementState.RELEASED;
        uint256 amount = receipt.amount;
        address payable recipient = receipt.recipient;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        releasing = false;

        emit SettlementReleased(key, settlementId, recipient, amount);
    }

    function matches_released(
        string calldata settlementId,
        string calldata dealId,
        address recipient,
        uint256 amount,
        uint8 kind,
        address source
    ) external view returns (bool) {
        SettlementReceipt storage receipt = receipts[keccak256(bytes(settlementId))];
        return receipt.state == SettlementState.RELEASED
            && receipt.dealHash == keccak256(bytes(dealId))
            && receipt.recipient == recipient
            && receipt.amount == amount
            && receipt.kind == kind
            && receipt.source == source
            && source == clauseFlow;
    }

    function get_settlement(string calldata settlementId)
        external
        view
        returns (
            address source,
            bytes32 dealHash,
            address recipient,
            uint256 amount,
            uint8 kind,
            SettlementState state
        )
    {
        SettlementReceipt storage receipt = receipts[keccak256(bytes(settlementId))];
        return (
            receipt.source,
            receipt.dealHash,
            receipt.recipient,
            receipt.amount,
            receipt.kind,
            receipt.state
        );
    }

    receive() external payable {
        revert InvalidSettlement();
    }
}
