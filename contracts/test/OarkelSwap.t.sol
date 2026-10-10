// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ZkBase} from "./ZkBase.sol";
import {MockToken} from "./Mocks.sol";
import {MockCurve, MockPonsFactory, MockPoolManager} from "./PonsMocks.sol";
import {OarkelPool} from "../src/OarkelPool.sol";
import {OarkelSwap} from "../src/OarkelSwap.sol";
import {IPonsFactory} from "../src/interfaces/IPons.sol";
import {IPoolManager} from "../src/interfaces/IPoolManager.sol";
import {PoseidonT4} from "../src/poseidon/PoseidonT4.sol";

/// Swaps from notes into notes (real proofs) and buys straight into a note, against a mock Pons curve.
contract OarkelSwapTest is ZkBase {
    MockToken internal token;
    MockPonsFactory internal factory;
    MockCurve internal curve;
    OarkelSwap internal swapper;
    address internal buyer = makeAddr("buyer");
    address internal carrier = makeAddr("carrier");

    function setUp() public {
        token = new MockToken();
        _deploy(token);
        factory = new MockPonsFactory();
        curve = new MockCurve(token, factory.feeEscrow());
        factory.register(address(token), address(curve), address(0xfee), 0);
        swapper = new OarkelSwap(IPonsFactory(address(factory)), IPoolManager(address(new MockPoolManager())), pool);
        vm.deal(buyer, 10 ether);
        vm.deal(address(this), 10 ether);
        vm.deal(address(curve), 10 ether);
    }

    /// Mirrors a leaf the swapper created: its value comes from the pool's accounting, as the app reads it from the Shrouded event.
    function _mirror(uint8 asset, uint256 value, uint256 blinding, uint256 idx, string memory sig) internal returns (Note memory n) {
        assertEq(idx, leaves.length);
        leaves.push(PoseidonT4.hash([uint256(asset), value, ownerHashOf(sig, blinding)]));
        assertEq(pool.getLastRoot(), _localRoot(), "local tree mirrors the pool");
        n = Note({asset: asset, value: value, blinding: blinding, index: idx});
    }

    /// The swap's two spend outputs come first in the tree; the root is checked once the new note is mirrored too.
    function _pushSpend(Spend memory sp) internal {
        leaves.push(sp.args.commitments[0]);
        leaves.push(sp.args.commitments[1]);
    }

    function _terms(string memory sig, uint256 blinding, uint256 minOut, address submitter, uint256 fee) internal returns (OarkelSwap.SwapTerms memory) {
        return OarkelSwap.SwapTerms({
            ownerHash: ownerHashOf(sig, blinding),
            minOut: minOut,
            deadline: block.timestamp + 600,
            submitter: submitter,
            submitterFee: fee,
            encryptedNote: hex"03"
        });
    }

    function _swapSpend(Note memory n, OarkelSwap.SwapTerms memory t) internal returns (Spend memory) {
        SpendInput memory s;
        s.sig = SIG_A;
        s.asset = n.asset;
        s.notes = one(n);
        s.exitValue = n.value;
        s.recipient = address(swapper);
        s.relayerAddr = address(swapper);
        s.relayerFee = 1;
        s.swapTerms = swapper.encodeSwapTerms(t);
        return prove(s);
    }

    function _assertHoldsNothing() internal view {
        assertEq(address(swapper).balance, 0, "swapper keeps no ETH");
        assertEq(token.balanceOf(address(swapper)), 0, "swapper keeps no tokens");
    }

    /* ------------------------------------------------------------ buy */

    function test_BuyLandsInANote() public {
        uint256 oh = ownerHashOf(SIG_A, 11); // before the prank: the hash is an external library call
        uint256 sharesBefore = pool.totalShares();
        vm.prank(buyer);
        (uint256 out, uint256 idx) = swapper.buy{value: 1 ether}(oh, 1, hex"02");
        assertEq(out, 0.99 ether * 1_000_000, "1% curve fee");
        _mirror(1, pool.totalShares() - sharesBefore, 11, idx, SIG_A);
        assertEq(token.balanceOf(buyer), 0, "nothing public lands with the buyer");
        _assertHoldsNothing();
    }

    function test_BuyRefundsUnfilledEth() public {
        curve.setFillCap(0.3 ether);
        uint256 oh = ownerHashOf(SIG_A, 12);
        uint256 before = buyer.balance;
        vm.prank(buyer);
        swapper.buy{value: 1 ether}(oh, 1, hex"02");
        assertEq(before - buyer.balance, 0.3 ether, "only the filled part was spent");
        _assertHoldsNothing();
    }

    function test_RevertWhen_BuyWithoutFloorOrPaused() public {
        vm.startPrank(buyer);
        vm.expectRevert(OarkelSwap.NoMinimumOut.selector);
        swapper.buy{value: 1 ether}(1, 0, "");
        vm.expectRevert(OarkelSwap.ZeroAmount.selector);
        swapper.buy(1, 1, "");
        curve.setGraduated(true);
        vm.expectRevert(OarkelSwap.TradingPaused.selector);
        swapper.buy{value: 1 ether}(1, 1, "");
        vm.stopPrank();
    }

    function test_RevertWhen_StrayEth() public {
        (bool ok,) = address(swapper).call{value: 1}("");
        assertFalse(ok);
    }

    /* ------------------------------------------------------------ swap */

    function test_SwapEthNoteIntoTokenNote_PaysTheCarrier() public {
        Note memory n = shroud(SIG_A, 0, 1 ether, 21);
        OarkelSwap.SwapTerms memory t = _terms(SIG_A, 22, 1, carrier, 0.001 ether);
        Spend memory sp = _swapSpend(n, t);

        // Only the named carrier can land it, and only through the swapper.
        vm.expectRevert(OarkelSwap.NotSubmitter.selector);
        swapper.swap(sp.proof, sp.args, sp.ext);
        vm.prank(carrier);
        vm.expectRevert(OarkelPool.NotRelayer.selector);
        pool.unshroud(sp.proof, sp.args, sp.ext);

        uint256 sharesBefore = pool.totalShares();
        uint256 idx = pool.nextIndex();
        vm.prank(carrier);
        (uint256 tokensOut,) = swapper.swap(sp.proof, sp.args, sp.ext);
        _pushSpend(sp);
        // Unshroud gives back the note minus the flat fee (the 1 wei relayer fee comes to the swapper too).
        uint256 ethIn = n.value - FLAT_ETH - 0.001 ether;
        assertEq(tokensOut, (ethIn - ethIn / 100) * 1_000_000);
        assertEq(carrier.balance, 0.001 ether, "carrier paid in ETH");
        Note memory got = _mirror(1, pool.totalShares() - sharesBefore, 22, idx + 2, SIG_A);
        assertGt(got.value, 0);
        _assertHoldsNothing();

        // The new note is an ordinary note: it can be spent like any other.
        SpendInput memory s;
        s.sig = SIG_A;
        s.asset = 1;
        s.notes = one(got);
        s.exitValue = got.value;
        s.recipient = buyer;
        Spend memory out = prove(s);
        pool.unshroud(out.proof, out.args, out.ext);
        assertGt(token.balanceOf(buyer), 0);
    }

    function test_SwapTokenNoteIntoEthNote_AnyoneCanLand() public {
        token.mint(address(this), 2_000_000 ether);
        token.approve(address(pool), type(uint256).max);
        Note memory n = shroud(SIG_A, 1, 1_000_000 ether, 31);
        uint256 worth = pool.valueOfShares(n.value);
        OarkelSwap.SwapTerms memory t = _terms(SIG_A, 32, 0.5 ether, address(0), 0.0002 ether);
        Spend memory sp = _swapSpend(n, t);

        uint256 idx = pool.nextIndex();
        uint256 carrierBefore = carrier.balance;
        vm.prank(carrier);
        (uint256 ethOut,) = swapper.swap(sp.proof, sp.args, sp.ext);
        _pushSpend(sp);
        uint256 sold = worth - FLAT_TOKEN;
        uint256 gross = sold / 1_000_000;
        assertEq(ethOut, gross - gross / 100 - 0.0002 ether);
        assertEq(carrier.balance - carrierBefore, 0.0002 ether, "with no submitter named, whoever lands it is paid");
        _mirror(0, ethOut - (ethOut * SHROUD_BPS + 9999) / 10_000, 32, idx + 2, SIG_A);
        _assertHoldsNothing();
    }

    function test_RevertWhen_SwapTermsTamperedSlippedOrLate() public {
        Note memory n = shroud(SIG_A, 0, 1 ether, 41);
        OarkelSwap.SwapTerms memory t = _terms(SIG_A, 42, 900_000 ether, address(0), 0);
        t.deadline = block.timestamp + 60;
        Spend memory sp = _swapSpend(n, t);

        // A different owner for the result breaks the proof.
        OarkelPool.ExtData memory forged = sp.ext;
        OarkelSwap.SwapTerms memory theirs = _terms(SIG_B, 42, 900_000 ether, address(0), 0);
        theirs.deadline = t.deadline;
        forged.encryptedOutput1 = swapper.encodeSwapTerms(theirs);
        vm.expectRevert(OarkelPool.InvalidProof.selector);
        swapper.swap(sp.proof, sp.args, forged);

        // Price below the minimum: the whole swap reverts and the note stays unspent.
        curve.setRate(500_000);
        vm.expectRevert();
        swapper.swap(sp.proof, sp.args, sp.ext);
        assertFalse(pool.nullifierSpent(sp.args.nullifiers[0]));
        curve.setRate(1_000_000);

        vm.warp(block.timestamp + 61);
        vm.expectRevert(OarkelSwap.SwapExpired.selector);
        swapper.swap(sp.proof, sp.args, sp.ext);
    }

    function test_RevertWhen_CurveCannotFillTheWholeSwap() public {
        Note memory n = shroud(SIG_A, 0, 1 ether, 51);
        Spend memory sp = _swapSpend(n, _terms(SIG_A, 52, 1, address(0), 0));
        curve.setFillCap(0.2 ether);
        vm.expectRevert(OarkelSwap.PartialFill.selector);
        swapper.swap(sp.proof, sp.args, sp.ext);
        assertFalse(pool.nullifierSpent(sp.args.nullifiers[0]));
    }

    function test_RevertWhen_NotASwapProof() public {
        Note memory n = shroud(SIG_A, 0, 1 ether, 61);
        SpendInput memory s;
        s.sig = SIG_A;
        s.asset = 0;
        s.notes = one(n);
        s.exitValue = n.value;
        s.recipient = address(swapper);
        s.relayerAddr = address(swapper);
        s.relayerFee = 1;
        Spend memory sp = prove(s); // ordinary ciphertext, no terms
        vm.expectRevert(OarkelSwap.BadSwap.selector);
        swapper.swap(sp.proof, sp.args, sp.ext);

        // Without a relayer fee the pool would let anyone land it directly, so the swapper refuses it.
        s.relayerFee = 0;
        s.swapTerms = swapper.encodeSwapTerms(_terms(SIG_A, 62, 1, address(0), 0));
        sp = prove(s);
        vm.expectRevert(OarkelSwap.BadSwap.selector);
        swapper.swap(sp.proof, sp.args, sp.ext);
    }

    function testFuzz_SwapTermsRoundTrip(uint256 oh, uint256 minOut, uint256 deadline, address who, uint256 fee, bytes memory note) public view {
        vm.assume(minOut != 0);
        OarkelSwap.SwapTerms memory t = OarkelSwap.SwapTerms(oh, minOut, deadline, who, fee, note);
        OarkelSwap.SwapTerms memory back = swapper.decodeSwapTerms(swapper.encodeSwapTerms(t));
        assertEq(back.ownerHash, oh);
        assertEq(back.minOut, minOut);
        assertEq(back.deadline, deadline);
        assertEq(back.submitter, who);
        assertEq(back.submitterFee, fee);
        assertEq(back.encryptedNote, note);
    }

    receive() external payable {}
}
