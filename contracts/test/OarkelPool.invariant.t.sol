// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OarkelPool, IProofVerifier} from "../src/OarkelPool.sol";
import {MockToken, AcceptAllVerifier} from "./Mocks.sol";

/// Plays an honest prover against the pool: every spend conserves value exactly
/// as the circuit would force. The invariants check that the pool stays solvent
/// and that a share never loses value.
contract PoolHandler is Test {
    OarkelPool public pool;
    MockToken public token;
    uint256[] public ethNotes;
    uint256[] public shareNotes;
    uint256 internal nonce = 1;
    bool public ppsDropped;
    uint256 public calls;

    uint256 constant FLAT_ETH = 0.0005 ether;
    uint256 constant FLAT_TOKEN = 20 ether;

    constructor(OarkelPool pool_, MockToken token_) {
        pool = pool_;
        token = token_;
        token.approve(address(pool), type(uint256).max);
    }

    receive() external payable {}

    function _checkPps(uint256 b0, uint256 s0) internal {
        // (b1 + 1) / (s1 + V) >= (b0 + 1) / (s0 + V), cross-multiplied. Only while shares exist on both sides.
        uint256 s1 = pool.totalShares();
        if (s0 == 0 || s1 == 0) return;
        uint256 b1 = pool.backing();
        if ((b1 + 1) * (s0 + 1e6) < (b0 + 1) * (s1 + 1e6)) ppsDropped = true;
    }

    function shroudEth(uint256 amount) external {
        amount = bound(amount, 1e12, 100 ether);
        vm.deal(address(this), amount);
        pool.shroud{value: amount}(0, amount, 1, "");
        ethNotes.push(amount - (amount * 25 + 9999) / 10_000);
        calls++;
    }

    function shroudToken(uint256 amount) external {
        amount = bound(amount, 1e9, 1e26);
        token.mint(address(this), amount);
        uint256 b0 = pool.backing();
        uint256 s0 = pool.totalShares();
        try pool.shroud(1, amount, 1, "") {
            shareNotes.push(pool.totalShares() - s0);
            _checkPps(b0, s0);
            calls++;
        } catch {}
    }

    function donate(uint256 amount) external {
        amount = bound(amount, 1, 1e25);
        token.mint(address(this), amount);
        uint256 b0 = pool.backing();
        uint256 s0 = pool.totalShares();
        pool.donate(amount);
        _checkPps(b0, s0);
        calls++;
    }

    function _args(uint8 asset, uint256 exitValue, uint256 fee) internal returns (OarkelPool.PublicArgs memory a) {
        a.root = pool.getLastRoot();
        a.asset = asset;
        a.nullifiers = [nonce++, nonce++];
        a.commitments = [nonce++, nonce++];
        a.exitValue = exitValue;
        a.transferFee = fee;
    }

    function _take(uint256[] storage notes, uint256 seed) internal returns (uint256 value) {
        uint256 i = seed % notes.length;
        value = notes[i];
        notes[i] = notes[notes.length - 1];
        notes.pop();
    }

    function spendEth(uint256 seed, uint256 exitPart, uint256 sendPart, bool viaUnshroud) external {
        if (ethNotes.length == 0) return;
        uint256 value = _take(ethNotes, seed);
        uint256 exitValue = bound(exitPart, 0, value);
        uint256 send = bound(sendPart, 0, value - exitValue);
        uint256 fee = (send * 10 + 9999) / 10_000;
        if (send + fee + exitValue > value) {
            send = 0;
            fee = 0;
        }
        uint256 change = value - exitValue - send - fee;
        OarkelPool.ExtData memory ext;
        if (viaUnshroud && exitValue >= FLAT_ETH) {
            ext.recipient = address(this);
            pool.unshroud("", _args(0, exitValue, fee), ext);
        } else {
            if (exitValue > 0) ext.relayer = address(this);
            pool.transact("", _args(0, exitValue, fee), ext);
        }
        if (send > 0) ethNotes.push(send);
        if (change > 0) ethNotes.push(change);
        calls++;
    }

    function spendToken(uint256 seed, uint256 exitPart, uint256 sendPart, bool viaUnshroud) external {
        if (shareNotes.length == 0) return;
        uint256 value = _take(shareNotes, seed);
        uint256 exitValue = bound(exitPart, 0, value);
        uint256 send = bound(sendPart, 0, value - exitValue);
        uint256 fee = (send * 10 + 9999) / 10_000;
        if (send + fee + exitValue > value) {
            send = 0;
            fee = 0;
        }
        uint256 change = value - exitValue - send - fee;
        uint256 b0 = pool.backing();
        uint256 s0 = pool.totalShares();
        OarkelPool.ExtData memory ext;
        bool unshroud = viaUnshroud && exitValue > 0 && pool.valueOfShares(exitValue) >= FLAT_TOKEN;
        if (unshroud) {
            ext.recipient = address(this);
            pool.unshroud("", _args(1, exitValue, fee), ext);
        } else {
            if (exitValue > 0 && pool.valueOfShares(exitValue) > 0) ext.relayer = address(this);
            else if (exitValue > 0) ext.relayer = address(this);
            pool.transact("", _args(1, exitValue, fee), ext);
        }
        if (send > 0) shareNotes.push(send);
        if (change > 0) shareNotes.push(change);
        _checkPps(b0, s0);
        calls++;
    }

    function sweep() external {
        if (pool.ethFees() == 0) return;
        pool.sweepEthFees();
        calls++;
    }

    function sumEth() external view returns (uint256 s) {
        for (uint256 i = 0; i < ethNotes.length; i++) s += ethNotes[i];
    }

    function sumShares() external view returns (uint256 s) {
        for (uint256 i = 0; i < shareNotes.length; i++) s += shareNotes[i];
    }
}

contract OarkelPoolInvariantTest is Test {
    OarkelPool internal pool;
    MockToken internal token;
    PoolHandler internal handler;

    function setUp() public {
        token = new MockToken();
        pool = new OarkelPool(IProofVerifier(address(new AcceptAllVerifier())), token, makeAddr("feeSink"), 25, 10, 0.0005 ether, 20 ether);
        handler = new PoolHandler(pool, token);
        targetContract(address(handler));
    }

    function invariant_EthIsFullyBacked() public view {
        assertEq(address(pool).balance, handler.sumEth() + pool.ethFees());
    }

    function invariant_SharesMatchNotes() public view {
        assertEq(pool.totalShares(), handler.sumShares());
    }

    function invariant_TokenIsFullyBacked() public view {
        assertGe(token.balanceOf(address(pool)), pool.backing() + pool.pendingYield());
        assertLe(pool.valueOfShares(pool.totalShares()), pool.backing());
    }

    function invariant_SharePriceNeverDrops() public view {
        assertFalse(handler.ppsDropped());
    }

    function invariant_PendingOnlyWithoutShares() public view {
        if (pool.totalShares() > 0) assertEq(pool.pendingYield(), 0);
    }
}
