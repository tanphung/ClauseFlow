# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from genlayer.gl._internal.gl_call import gl_call_generic
from genlayer.py.evm.calldata import MethodEncoder


MATCHES_RELEASED = MethodEncoder(
    "matches_released",
    (str, str, Address, u256, u8, Address),
    bool,
)


@gl.evm.contract_interface
class SettlementRouter:
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


class SettlementConfirmationCanary(gl.Contract):
    router: Address
    settlement_id: str
    deal_id: str
    recipient: Address
    amount: u256
    confirmed: bool

    def __init__(self, router_address: str):
        self.router = Address(router_address)
        self.settlement_id = ""
        self.deal_id = ""
        self.recipient = Address("0x0000000000000000000000000000000000000000")
        self.amount = 0
        self.confirmed = False

    @gl.public.write.payable
    def probe(self, marker: str, recipient: str) -> None:
        if self.amount != 0:
            raise gl.vm.UserError("Probe already initialized")
        if gl.message.value == 0:
            raise gl.vm.UserError("Probe requires GEN")
        self.settlement_id = "ethcall-confirm-" + marker
        self.deal_id = "deal-" + marker
        self.recipient = Address(recipient)
        self.amount = gl.message.value
        target = SettlementRouter(self.router)
        target.emit_transfer(value=gl.message.value)
        target.emit().fund_settlement(
            self.settlement_id,
            self.deal_id,
            self.recipient,
            gl.message.value,
            u8(1),
        )

    @gl.public.write
    def confirm(self) -> None:
        if self.amount == 0:
            raise gl.vm.UserError("Probe has not been initialized")
        calldata = MATCHES_RELEASED.encode_call(
            (
                self.settlement_id,
                self.deal_id,
                self.recipient,
                self.amount,
                u8(1),
                gl.message.contract_address,
            )
        )
        result = gl_call_generic(
            {
                "EthCall": {
                    "address": self.router,
                    "calldata": calldata,
                }
            },
            MATCHES_RELEASED.decode_ret,
        )
        if not bool(result.get()):
            raise gl.vm.UserError("Exact released receipt was not found")
        self.confirmed = True

    @gl.public.view
    def get_settlement_id(self) -> str:
        return self.settlement_id

    @gl.public.view
    def get_confirmed(self) -> bool:
        return self.confirmed
