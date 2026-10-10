// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ZkBase} from "./ZkBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OarkelPool} from "../src/OarkelPool.sol";
import {OarkelSwap} from "../src/OarkelSwap.sol";
import {IPonsFactory, PonsLaunchedToken, PonsSocials, PonsTokenParams} from "../src/interfaces/IPons.sol";
import {IPoolManager} from "../src/interfaces/IPoolManager.sol";
import {PoseidonT4} from "../src/poseidon/PoseidonT4.sol";

interface IPonsFactoryFull is IPonsFactory {
    function createGraduatedPool(address token) external returns (uint256 positionId);
}

/// Robinhood Chain mainnet fork with the real Pons V2 stack: a fresh launch, a pool for it, swaps from notes into
/// notes (real proofs) on the bonding curve and then, after graduation, in the Pons Uniswap v4 pool. A last test
/// buys into the live OarkelPool through the live $OARKEL curve.
///   forge test --match-path test/OarkelSwap.fork.t.sol --evm-version cancun --fork-url https://robinhood.drpc.org \
///     --libraries src/poseidon/PoseidonT3.sol:PoseidonT3:0xa09ceb11d309f8c71bed947f85cbe524910ac53f \
///     --libraries src/poseidon/PoseidonT4.sol:PoseidonT4:0xa4549b7d8c670a1d0982e8fbeda3c6d553d22f62
contract OarkelSwapForkTest is ZkBase {
    IPonsFactoryFull constant PONS = IPonsFactoryFull(0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e);
    IPoolManager constant POOL_MANAGER = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    OarkelPool constant LIVE_POOL = OarkelPool(payable(0xf65100F07A4BbF57047d774Ec683F5b741DD55f2));

    OarkelSwap swapper;
    IERC20 token;
    address carrier = makeAddr("carrier");
    address whale = makeAddr("whale");

    modifier onFork() {
        if (block.chainid != 4663) vm.skip(true);
        _;
    }

    function setUp() public {
        if (block.chainid != 4663) return;
        PonsTokenParams memory p;
        p.name = "Fork Oarkel";
        p.symbol = "FOARKEL";
        p.description = "fork test";
        p.socials = PonsSocials("", "", "", "", "");
        p.creatorFeeRecipient = address(this);
        p.salt = keccak256("oarkel-swap-fork");
        (address t,) = PONS.launchToken{value: PONS.launchFee()}(p, 0, address(0));
        token = IERC20(t);
        _deploy(token);
        swapper = new OarkelSwap(PONS, POOL_MANAGER, pool);
        vm.deal(address(this), 50 ether);
        vm.deal(whale, 20 ether);
        vm.warp(block.timestamp + 30); // past the launch snipe window
    }

    function _swapSpend(Note memory n, uint256 oh, uint256 minOut) internal returns (Spend memory) {
        SpendInput memory s;
        s.sig = SIG_A;
        s.asset = n.asset;
        s.notes = one(n);
        s.exitValue = n.value;
        s.recipient = address(swapper);
        s.relayerAddr = address(swapper);
        s.relayerFee = 1;
        s.swapTerms = swapper.encodeSwapTerms(
            OarkelSwap.SwapTerms({
                ownerHash: oh,
                minOut: minOut,
                deadline: block.timestamp + 600,
                submitter: carrier,
                submitterFee: 0.0002 ether,
                encryptedNote: hex"03"
            })
        );
        return prove(s);
    }

    function _swap(Note memory n, uint256 blinding, uint256 minOut) internal returns (Note memory got) {
        uint256 oh = ownerHashOf(SIG_A, blinding);
        Spend memory sp = _swapSpend(n, oh, minOut);
        got.asset = n.asset == 0 ? 1 : 0;
        got.blinding = blinding;
        uint256 sharesBefore = pool.totalShares();
        uint256 carrierBefore = carrier.balance;
        vm.prank(carrier);
        uint256 g = gasleft();
        (uint256 out, uint256 idx) = swapper.swap(sp.proof, sp.args, sp.ext);
        emit log_named_uint(n.asset == 0 ? "swap gas ETH->token" : "swap gas token->ETH", g - gasleft());
        leaves.push(sp.args.commitments[0]);
        leaves.push(sp.args.commitments[1]);
        got.value = got.asset == 1 ? pool.totalShares() - sharesBefore : out - (out * SHROUD_BPS + 9999) / 10_000;
        got.index = idx;
        leaves.push(PoseidonT4.hash([uint256(got.asset), got.value, oh]));
        assertEq(idx, leaves.length - 1);
        assertEq(pool.getLastRoot(), _localRoot(), "local tree mirrors the pool");
        assertEq(carrier.balance - carrierBefore, 0.0002 ether);
        assertEq(address(swapper).balance, 0);
        assertEq(token.balanceOf(address(swapper)), 0);
    }

    function test_Fork_CurveThenPool_SwapsBothWays() public onFork {
        assertEq(PONS.getLaunchedToken(address(token)).phase, 0);

        // Curve phase: ETH note -> token note -> ETH note.
        Note memory a = shroud(SIG_A, 0, 0.2 ether, 1);
        Note memory b = _swap(a, 2, 1);
        assertEq(b.asset, 1);
        Note memory c = _swap(b, 3, 0.1 ether);
        assertEq(c.asset, 0);
        emit log_named_uint("ETH note after a round trip on the curve", c.value);

        // Fill the curve, graduate, open the v4 pool. Swaps pause in between.
        address curve = PONS.getLaunchedToken(address(token)).curve;
        (bool ok,) = curve.call{value: 8 ether}(abi.encodeWithSignature("buy(uint256,uint256,address)", 8 ether, 1, whale));
        ok; // the crossing buy may be partly refunded to this test
        assertEq(PONS.getLaunchedToken(address(token)).phase, 1, "swept");
        PONS.createGraduatedPool(address(token));
        assertEq(PONS.getLaunchedToken(address(token)).phase, 2);

        // Pool phase: the same contract now trades in v4.
        Note memory d = _swap(c, 4, 1);
        assertEq(d.asset, 1);
        Note memory e = _swap(d, 5, 0.05 ether);
        assertEq(e.asset, 0);
        emit log_named_uint("ETH note after a round trip in v4", e.value);
    }

    function test_Fork_BuyIntoTheLivePool() public onFork {
        PonsLaunchedToken memory l = PONS.getLaunchedToken(address(LIVE_POOL.token()));
        if (l.phase != 0 && l.phase != 2) vm.skip(true);
        OarkelSwap live = new OarkelSwap(PONS, POOL_MANAGER, LIVE_POOL);
        uint256 sharesBefore = LIVE_POOL.totalShares();
        uint256 g = gasleft();
        (uint256 out,) = live.buy{value: 0.001 ether}(ownerHashOf(SIG_A, 9), 1, hex"03");
        emit log_named_uint("buy gas (live pool)", g - gasleft());
        assertGt(out, 0);
        assertGt(LIVE_POOL.totalShares(), sharesBefore);
        assertEq(address(live).balance, 0);
        assertEq(LIVE_POOL.token().balanceOf(address(live)), 0);
    }

    receive() external payable {}
}
