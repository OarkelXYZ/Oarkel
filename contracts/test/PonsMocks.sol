// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockToken} from "./Mocks.sol";
import {PonsLaunchedToken} from "../src/interfaces/IPons.sol";

/// Bonding curve stand-in: fixed price (`rate` tokens per ETH), 1% fee kept as "creator fee",
/// optional partial fill, and the same checks the Pons curve makes on minimum outputs.
contract MockCurve {
    MockToken public immutable token;
    uint256 public rate = 1_000_000; // tokens per ETH
    uint256 public fillCap = type(uint256).max; // max ETH taken per buy (the rest is refunded)
    bool public graduated;
    bool public readyToGraduate;
    uint256 public creatorFees;
    address public deployer;
    bool public sweepNeedsOperator;
    MockEscrow public escrow;

    error SlippageExceeded(uint256 out, uint256 min);

    constructor(MockToken token_, MockEscrow escrow_) {
        token = token_;
        escrow = escrow_;
    }

    // Views the site's market reader calls (src/lib/pons.ts).
    function feeBps() external pure returns (uint256) {
        return 100;
    }

    function creatorTaxBps() external pure returns (uint256) {
        return 0;
    }

    /// Reserves consistent with the fixed rate (quote / token = 1 / rate) for the site's sell estimate.
    function getReserves() external view returns (uint256 quoteReserve, uint256 tokenReserve) {
        return (1e24, 1e24 * rate);
    }

    function realQuoteReserve() external view returns (uint256) {
        return address(this).balance;
    }

    function graduationThreshold() external pure returns (uint256) {
        return 4.2 ether;
    }

    function setRate(uint256 r) external {
        rate = r;
    }

    function setFillCap(uint256 c) external {
        fillCap = c;
    }

    function setGraduated(bool g) external {
        graduated = g;
    }

    function setDeployer(address d) external {
        deployer = d;
    }

    function setSweepNeedsOperator(bool v) external {
        sweepNeedsOperator = v;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 out) {
        require(msg.value == quoteIn, "value");
        uint256 used = quoteIn > fillCap ? fillCap : quoteIn;
        uint256 fee = used / 100;
        creatorFees += fee;
        out = (used - fee) * rate;
        if (out < minTokensOut) revert SlippageExceeded(out, minTokensOut);
        token.mint(recipient, out);
        if (used < quoteIn) {
            (bool ok,) = msg.sender.call{value: quoteIn - used}("");
            require(ok, "refund");
        }
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256 out) {
        token.transferFrom(msg.sender, address(this), tokensIn);
        uint256 gross = tokensIn / rate;
        uint256 fee = gross / 100;
        creatorFees += fee;
        out = gross - fee;
        if (out < minQuoteOut) revert SlippageExceeded(out, minQuoteOut);
        (bool ok,) = recipient.call{value: out}("");
        require(ok, "pay");
    }

    /// Moves accrued creator fees into the escrow, like the real curve does for its creator.
    function sweepFees(uint256) external {
        require(msg.sender == deployer, "not creator");
        require(!sweepNeedsOperator, "operator only");
        uint256 f = creatorFees;
        creatorFees = 0;
        escrow.credit{value: f}(deployer);
    }

    receive() external payable {}
}

contract MockEscrow {
    mapping(address => uint256) public balanceOf;

    function credit(address recipient) external payable {
        balanceOf[recipient] += msg.value;
    }

    function claim() external returns (uint256 amount) {
        amount = balanceOf[msg.sender];
        require(amount > 0, "zero");
        balanceOf[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "claim");
    }
}

contract MockHook {
    function sweepPoolFees(bytes32, uint256, uint256) external pure {
        revert("operator only");
    }
}

contract MockPonsFactory {
    MockEscrow public feeEscrow;
    MockHook public hook;
    mapping(address => PonsLaunchedToken) internal launched;

    constructor() {
        feeEscrow = new MockEscrow();
        hook = new MockHook();
    }

    function memeHook() external view returns (address) {
        return address(hook);
    }

    function register(address token, address curve, address creatorFeeRecipient, uint8 phase) external {
        PonsLaunchedToken storage l = launched[token];
        l.token = token;
        l.curve = curve;
        l.deployer = msg.sender;
        l.creatorFeeRecipient = creatorFeeRecipient;
        l.poolFee = 0;
        l.tickSpacing = 200;
        l.phase = phase;
        l.exists = true;
    }

    function getLaunchedToken(address token) external view returns (PonsLaunchedToken memory) {
        return launched[token];
    }
}

/// Stands in for the v4 PoolManager in unit tests; only its address matters (it must have code).
contract MockPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        revert("not in unit tests");
    }
}
