// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OarkelPool, IProofVerifier} from "../src/OarkelPool.sol";
import {PoseidonT3} from "../src/poseidon/PoseidonT3.sol";
import {PoseidonT4} from "../src/poseidon/PoseidonT4.sol";
import {MockToken, FeeToken, AcceptAllVerifier} from "./Mocks.sol";

/// Unit and fuzz tests of the pool's accounting. Proof checks are covered with
/// real proofs in OarkelPool.proofs.t.sol; here the verifier accepts everything
/// and the tests play an honest prover.
contract OarkelPoolTest is Test {
    OarkelPool internal pool;
    MockToken internal token;
    IProofVerifier internal verifier;
    address internal feeSink = makeAddr("feeSink");
    uint256 internal nonce = 1;

    uint256 constant FLAT_ETH = 0.0005 ether;
    uint256 constant FLAT_TOKEN = 20 ether;

    function setUp() public {
        token = new MockToken();
        verifier = IProofVerifier(address(new AcceptAllVerifier()));
        pool = new OarkelPool(verifier, token, feeSink, 25, 10, FLAT_ETH, FLAT_TOKEN);
        token.mint(address(this), type(uint128).max);
        token.approve(address(pool), type(uint256).max);
        vm.deal(address(this), 1e30);
    }

    receive() external payable {}

    /* ---------------------------------------------------------- hashing */

    function test_PoseidonVectorsMatchCircuitAndBrowser() public pure {
        assertEq(PoseidonT3.hash([uint256(1), 2]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
        assertEq(PoseidonT4.hash([uint256(1), 2, 3]), 0x0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732);
    }

    function test_ZeroHashesAreConsistent() public view {
        for (uint256 i = 0; i < 24; i++) {
            assertEq(pool.zeros(i + 1), PoseidonT3.hash([pool.zeros(i), pool.zeros(i)]));
        }
        assertEq(pool.getLastRoot(), pool.zeros(24));
    }

    /* ---------------------------------------------------------- constructor */

    function test_RevertWhen_ConstructorParametersAreBad() public {
        vm.expectRevert(OarkelPool.BadParameter.selector);
        new OarkelPool(IProofVerifier(address(0x1234)), token, feeSink, 25, 10, 1, 1);
        vm.expectRevert(OarkelPool.BadParameter.selector);
        new OarkelPool(verifier, IERC20(address(0x1234)), feeSink, 25, 10, 1, 1);
        vm.expectRevert(OarkelPool.BadParameter.selector);
        new OarkelPool(verifier, token, address(0), 25, 10, 1, 1);
        vm.expectRevert(OarkelPool.BadParameter.selector);
        new OarkelPool(verifier, token, feeSink, 501, 10, 1, 1);
        vm.expectRevert(OarkelPool.BadParameter.selector);
        new OarkelPool(verifier, token, feeSink, 25, 501, 1, 1);
        vm.expectRevert(OarkelPool.BadParameter.selector);
        new OarkelPool(verifier, token, feeSink, 25, 10, 1 << 121, 1);
    }

    /* ---------------------------------------------------------- shroud */

    function test_RevertWhen_ShroudInputsAreBad() public {
        vm.expectRevert(OarkelPool.BadAmount.selector);
        pool.shroud{value: 1}(0, 2, 1, "");
        vm.expectRevert(OarkelPool.BadAmount.selector);
        pool.shroud(0, 0, 1, "");
        vm.expectRevert(OarkelPool.BadAsset.selector);
        pool.shroud(2, 1, 1, "");
        vm.expectRevert(OarkelPool.BadAmount.selector);
        pool.shroud{value: 1}(1, 1 ether, 1, "");
        uint256 p = pool.FIELD_SIZE();
        vm.expectRevert(OarkelPool.NotInField.selector);
        pool.shroud{value: 1 ether}(0, 1 ether, p, "");
        vm.expectRevert(OarkelPool.NoteTooLarge.selector);
        pool.shroud{value: 1 ether}(0, 1 ether, 1, new bytes(513));
        // One wei: the fee rounds up to the whole amount, nothing would be left in the note.
        vm.expectRevert(OarkelPool.BadAmount.selector);
        pool.shroud{value: 1}(0, 1, 1, "");
    }

    function test_RevertWhen_TokenTakesAFeeOnTransfer() public {
        FeeToken ft = new FeeToken();
        OarkelPool p = new OarkelPool(verifier, ft, feeSink, 25, 10, FLAT_ETH, FLAT_TOKEN);
        ft.mint(address(this), 1000 ether);
        ft.approve(address(p), type(uint256).max);
        vm.expectRevert(OarkelPool.FeeOnTransferToken.selector);
        p.shroud(1, 100 ether, 1, "");
        vm.expectRevert(OarkelPool.FeeOnTransferToken.selector);
        p.donate(100 ether);
    }

    function test_ShroudCommitmentIsComputedOnChain() public {
        vm.recordLogs();
        pool.shroud{value: 1 ether}(0, 1 ether, 42, hex"beef");
        uint256 value = 1 ether - 0.0025 ether;
        uint256 expected = PoseidonT4.hash([uint256(0), value, 42]);
        assertEq(pool.nextIndex(), 1);
        assertEq(pool.getLastRoot() != pool.zeros(24), true);
        // Leaf 0 sits on the all-zero path.
        uint256 node = expected;
        for (uint256 i = 0; i < 24; i++) node = PoseidonT3.hash([node, pool.zeros(i)]);
        assertEq(pool.getLastRoot(), node);
        assertTrue(pool.isKnownRoot(node));
    }

    function test_DonationBeforeAnySharesWaitsForTheFirstHolder() public {
        pool.donate(500 ether);
        assertEq(pool.pendingYield(), 500 ether);
        assertEq(pool.backing(), 0);
        pool.shroud(1, 1000 ether, 1, "");
        assertEq(pool.pendingYield(), 0);
        assertEq(pool.backing(), 1000 ether + 500 ether);
        // The first holder gets the pending yield.
        assertApproxEqAbs(pool.valueOfShares(pool.totalShares()), 1500 ether, 1e7);
    }

    function test_RevertWhen_NothingToSweep() public {
        vm.expectRevert(OarkelPool.NothingToSweep.selector);
        pool.sweepEthFees();
    }

    function test_RootHistoryForgetsOldRoots() public {
        uint256 first;
        for (uint256 i = 0; i < 101; i++) {
            pool.shroud{value: 1 ether}(0, 1 ether, i + 1, "");
            if (i == 0) first = pool.getLastRoot();
            if (i == 99) assertTrue(pool.isKnownRoot(first));
        }
        assertFalse(pool.isKnownRoot(first));
        assertFalse(pool.isKnownRoot(0));
    }

    /* ---------------------------------------------------------- spends (accounting) */

    function _args(uint8 asset, uint256 exitValue, uint256 fee) internal returns (OarkelPool.PublicArgs memory a) {
        a.root = pool.getLastRoot();
        a.asset = asset;
        a.nullifiers = [nonce++, nonce++];
        a.commitments = [nonce++, nonce++];
        a.exitValue = exitValue;
        a.transferFee = fee;
    }

    function _ext(address recipient, address relayer, uint256 relayerFee) internal pure returns (OarkelPool.ExtData memory e) {
        e.recipient = recipient;
        e.relayer = relayer;
        e.relayerFee = relayerFee;
    }

    function test_RevertWhen_ExitDoesNotCoverFees() public {
        pool.shroud{value: 1 ether}(0, 1 ether, 1, "");
        OarkelPool.PublicArgs memory a = _args(0, FLAT_ETH, 0);
        vm.expectRevert(OarkelPool.NotRelayer.selector);
        pool.unshroud("", a, _ext(address(1), address(2), 1));
        vm.prank(address(2));
        vm.expectRevert(OarkelPool.ExitTooSmall.selector);
        pool.unshroud("", a, _ext(address(1), address(2), 1));
        a = _args(0, 0, 0);
        vm.expectRevert(OarkelPool.BadAmount.selector);
        pool.unshroud("", a, _ext(address(1), address(0), 0));
        a = _args(0, 1 ether, 0);
        vm.expectRevert(OarkelPool.BadRelayer.selector);
        pool.unshroud("", a, _ext(address(1), address(0), 1));
        a = _args(0, 1, 0);
        vm.expectRevert(OarkelPool.NotRelayer.selector);
        pool.transact("", a, _ext(address(0), address(0x1234), 0));
        vm.prank(address(0));
        vm.expectRevert(OarkelPool.BadRelayer.selector);
        pool.transact("", a, _ext(address(0), address(0), 0));
        a = _args(0, 0, 0);
        a.nullifiers[1] = a.nullifiers[0];
        vm.expectRevert(OarkelPool.SameNullifier.selector);
        pool.transact("", a, _ext(address(0), address(0), 0));
    }

    function testFuzz_ShroudEthFee(uint256 amount) public {
        amount = bound(amount, 2, 1e30);
        uint256 fee = (amount * 25 + 9999) / 10_000;
        if (fee >= amount) return;
        pool.shroud{value: amount}(0, amount, 7, "");
        assertEq(pool.ethFees(), fee);
        assertEq(address(pool).balance, amount);
    }

    /// First-depositor inflation: a tiny first deposit plus a large donation can only
    /// cost the next depositor a rounding error of about one share price, and never pays the attacker.
    function testFuzz_InflationAttackIsUneconomic(uint256 a, uint256 d, uint256 x) public {
        a = bound(a, 401, 1e18);
        d = bound(d, 0, 1e27);
        x = bound(x, 1e15, 1e27);
        address attacker = makeAddr("attacker");
        token.transfer(attacker, a + d);
        vm.startPrank(attacker);
        token.approve(address(pool), type(uint256).max);
        pool.shroud(1, a, 1, "");
        uint256 attackerShares = pool.totalShares();
        if (d > 0) pool.donate(d);
        vm.stopPrank();

        uint256 pps = pool.valueOfShares(1e6 * 1e18) / 1e18 + 1; // value of 1e6 shares, rounded up
        uint256 before = pool.totalShares();
        uint256 net = x - (x * 25 + 9999) / 10_000;
        try pool.shroud(1, x, 2, "") {
            uint256 victimShares = pool.totalShares() - before;
            uint256 victimValue = pool.valueOfShares(victimShares);
            assertGe(victimValue + pps + 1, net, "victim loses at most about one share price");
            assertLe(pool.valueOfShares(attackerShares), a + d + (x - net), "attacker cannot profit");
        } catch (bytes memory reason) {
            // Only refused when the deposit would mint zero shares.
            assertEq(bytes4(reason), OarkelPool.ZeroShares.selector);
        }
    }

    function testFuzz_TokenRoundTripNeverPaysMoreThanDeposited(uint256 x, uint256 y, uint256 exitPart) public {
        x = bound(x, 1 ether, 1e27);
        y = bound(y, 1 ether, 1e27);
        pool.shroud(1, x, 1, "");
        uint256 sharesX = pool.totalShares();
        pool.shroud(1, y, 2, "");
        uint256 exitShares = bound(exitPart, 1, sharesX);
        uint256 gross = pool.valueOfShares(exitShares);
        if (gross < FLAT_TOKEN) return;
        address to = makeAddr("to");
        pool.unshroud("", _args(1, exitShares, 0), _ext(to, address(0), 0));
        assertEq(token.balanceOf(to), gross - FLAT_TOKEN);
        // x's holder never gets back more than x plus the yield it earned (y's shroud fee).
        assertLe(token.balanceOf(to), x + (y * 25 + 9999) / 10_000);
        assertGe(token.balanceOf(address(pool)), pool.backing() + pool.pendingYield());
        assertLe(pool.valueOfShares(pool.totalShares()), pool.backing());
    }
}
