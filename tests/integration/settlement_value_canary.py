# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


@gl.evm.contract_interface
class CanaryRouter:
    class View:
        pass

    class Write:
        def fund_settlement(
            self,
            settlement_id: str,
            deal_id: str,
            recipient: Address,
            amount: u256,
            kind: u8,
            /,
        ) -> None: ...


class SettlementValueCanary(gl.Contract):
    router: Address
    last_settlement_id: str

    def __init__(self, router: str):
        self.router = Address(router)
        self.last_settlement_id = ""

    @gl.public.write.payable
    def probe(self, marker: str, recipient: str) -> None:
        amount = gl.message.value
        if amount == u256(0):
            raise gl.vm.UserError("Canary value must be greater than zero")
        settlement_id = "CANARY|" + marker + "|" + str(amount)
        self.last_settlement_id = settlement_id
        target = CanaryRouter(self.router)
        target.emit_transfer(value=amount)
        target.emit().fund_settlement(
            settlement_id,
            marker,
            Address(recipient),
            amount,
            u8(1),
        )

    @gl.public.view
    def get_last_settlement_id(self) -> str:
        return self.last_settlement_id
