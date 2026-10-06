// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ZkBase} from "./ZkBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Robinhood Chain mainnet fork. Run with the deployed Poseidon libraries linked:
///   forge test --match-contract Fork --evm-version cancun --fork-url <rpc> \
///     --libraries src/poseidon/PoseidonT3.sol:PoseidonT3:0x3333333C0A88F9BE4fd23ed0536F9B6c427e3B93 \
///     --libraries src/poseidon/PoseidonT4.sol:PoseidonT4:0x4443338EF595F44e0121df4C21102677B142ECF0
/// A live Pons V2 token stands in for $OARKEL (same launchpad, same ERC-20 code).
contract OarkelPoolForkTest is ZkBase {
    address constant POSEIDON_T3 = 0x3333333C0A88F9BE4fd23ed0536F9B6c427e3B93;
    address constant POSEIDON_T4 = 0x4443338EF595F44e0121df4C21102677B142ECF0;
    /// $OLAZ, launched on Pons V2 (factory 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e).
    IERC20 constant PONS_TOKEN = IERC20(0x253278BF0a17f7d107f0559713F5870180F3B51a);

    function setUp() public {
        if (block.chainid != 4663) return;
        _deploy(PONS_TOKEN);
        vm.deal(address(this), 10 ether);
        deal(address(PONS_TOKEN), address(this), 1_000_000 ether);
        PONS_TOKEN.approve(address(pool), type(uint256).max);
    }

    modifier onFork() {
        if (block.chainid != 4663) {
            vm.skip(true);
        }
        _;
    }

    function test_Fork_DeployedPoseidonMatchesVectors() public onFork {
        assertGt(POSEIDON_T3.code.length, 0);
        assertGt(POSEIDON_T4.code.length, 0);
        (bool ok, bytes memory out) = POSEIDON_T3.staticcall(abi.encodeWithSignature("hash(uint256[2])", [uint256(1), 2]));
        assertTrue(ok);
        assertEq(abi.decode(out, (uint256)), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
        (ok, out) = POSEIDON_T4.staticcall(abi.encodeWithSignature("hash(uint256[3])", [uint256(1), 2, 3]));
        assertTrue(ok);
        assertEq(abi.decode(out, (uint256)), 0x0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732);
    }

    function test_Fork_PonsTokenShroudYieldUnshroud() public onFork {
        Note memory n = shroud(SIG_A, 1, 50_000 ether, 3);
        pool.donate(500 ether);
        address to = makeAddr("to");
        SpendInput memory s;
        s.sig = SIG_A;
        s.asset = 1;
        s.notes = one(n);
        s.exitValue = n.value;
        s.recipient = to;
        s.relayerAddr = relayer;
        s.relayerFee = 8 ether;
        uint256 worth = pool.valueOfShares(n.value);
        Spend memory sp = prove(s);
        vm.prank(relayer);
        pool.unshroud(sp.proof, sp.args, sp.ext);
        assertEq(PONS_TOKEN.balanceOf(to), worth - FLAT_TOKEN - 8 ether);
        assertGt(worth, 50_000 ether, "donation reached the shrouded holder");
    }

    function test_Fork_EthSendThenUnshroud() public onFork {
        Note memory n = shroud(SIG_A, 0, 1 ether, 4);
        SpendInput memory s;
        s.sig = SIG_A;
        s.notes = one(n);
        s.paySig = SIG_B;
        s.payValue = 0.25 ether;
        Spend memory sp = prove(s);
        pool.transact(sp.proof, sp.args, sp.ext);
        Note memory bobs = landed(sp, SIG_B);
        SpendInput memory b;
        b.sig = SIG_B;
        b.notes = one(bobs);
        b.exitValue = bobs.value;
        b.recipient = makeAddr("bobOut");
        Spend memory sb = prove(b);
        uint256 g = gasleft();
        pool.unshroud(sb.proof, sb.args, sb.ext);
        emit log_named_uint("unshroud gas on fork", g - gasleft());
        assertEq(b.recipient.balance, 0.25 ether - FLAT_ETH);
    }
}
