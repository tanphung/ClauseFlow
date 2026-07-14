"""Windows-safe direct-mode deployment fixture.

gltest 0.25-0.29 unlinks the message-context file while fd 0 still references
it, which Windows rejects. Keep the file only until the contract module is
loaded, then restore stdin and remove it immediately.
"""

import os
import tempfile

import pytest
from gltest.direct import loader


def _windows_inject_message_to_fd0(vm) -> None:
    from genlayer.py import calldata
    from genlayer.py.types import Address

    sender = Address(vm.sender) if isinstance(vm.sender, bytes) else vm.sender
    contract = Address(vm._contract_address) if isinstance(vm._contract_address, bytes) else vm._contract_address
    origin = Address(vm.origin) if isinstance(vm.origin, bytes) else vm.origin
    encoded = calldata.encode({
        "contract_address": contract,
        "sender_address": sender,
        "origin_address": origin,
        "stack": [],
        "value": vm._value,
        "datetime": vm._datetime,
        "is_init": False,
        "chain_id": vm._chain_id,
        "entry_kind": 0,
        "entry_data": b"",
        "entry_stage_data": None,
    })
    fd, path = tempfile.mkstemp(prefix="clauseflow-gltest-")
    try:
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        vm._clauseflow_stdin_path = path
    finally:
        os.close(fd)


def _restore_stdin(vm) -> None:
    stdin_fd = getattr(vm, "_original_stdin_fd", None)
    if stdin_fd is not None:
        os.dup2(stdin_fd, 0)
        os.close(stdin_fd)
        vm._original_stdin_fd = None
    path = getattr(vm, "_clauseflow_stdin_path", "")
    if path and os.path.exists(path):
        os.unlink(path)
        vm._clauseflow_stdin_path = ""


if os.name == "nt":
    loader._inject_message_to_fd0 = _windows_inject_message_to_fd0


@pytest.fixture
def direct_deploy(direct_vm):
    def deploy(path, *args, sdk_version=None, **kwargs):
        try:
            return loader.deploy_contract(path, direct_vm, *args, sdk_version=sdk_version, **kwargs)
        finally:
            _restore_stdin(direct_vm)

    return deploy
