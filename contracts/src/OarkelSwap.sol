// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OarkelPool} from "./OarkelPool.sol";
import {IPonsFactory, IPonsCurve, PonsLaunchedToken} from "./interfaces/IPons.sol";
import {IPoolManager, IUnlockCallback, PoolKey, SwapParams} from "./interfaces/IPoolManager.sol";

/**
 * @title OarkelSwap
 * @notice Trades between ETH and $OARKEL on the token's Pons market, from notes into notes, in one transaction.
 *
 *   swap  A pool unshroud proof whose recipient and relayer are this contract. The notes leave the pool here,
 *         are traded on the Pons bonding curve (before graduation) or in the Pons Uniswap v4 pool (after), and
 *         the result is shrouded straight back into one new note of the other asset. The swap terms (new
 *         note owner, minimum out, deadline, who may land it and their fee) ride in the proof's second
 *         encrypted output, so the proof binds them and nobody can redirect the result.
 *   buy   ETH from a wallet, $OARKEL bought the same way and shrouded into a new note. The purchase is
 *         public; the note is not.
 *
 * The pool lets a spend that pays a relayer be landed only by that relayer. A swap proof names this
 * contract as relayer with a fee of at least one unit, so the pool accepts it only through `swap` and the
 * notes can never be stranded here. Trades pay Pons' own fees; this contract adds none, holds nothing
 * between transactions, and has no owner, admin or upgrade path.
 */
contract OarkelSwap is ReentrancyGuard, IUnlockCallback {
    using SafeERC20 for IERC20;

    uint8 private constant ASSET_ETH = 0;
    uint8 private constant ASSET_TOKEN = 1;
    uint8 private constant PHASE_CURVE = 0;
    uint8 private constant PHASE_POOL = 2;
    uint160 private constant MIN_SQRT_PRICE_PLUS_ONE = 4295128740;
    uint160 private constant MAX_SQRT_PRICE_MINUS_ONE = 1461446703485210103287273052203988822378723970341;

    /// @notice First bytes of a swap-terms blob: "OARKEL-SWAP-v1" padded to 16 bytes.
    bytes16 public constant SWAP_MAGIC = "OARKEL-SWAP-v1";

    IPonsFactory public immutable factory;
    IPoolManager public immutable poolManager;
    OarkelPool public immutable pool;
    IERC20 public immutable token;

    bool private _expectingEth;

    /// Decoded from `ext.encryptedOutput1` of a swap proof.
    struct SwapTerms {
        /// Poseidon(ownerPk, blinding) of the note that receives the result.
        uint256 ownerHash;
        /// Lowest acceptable amount shrouded into the new note (after the submitter's fee, before the pool's shroud fee).
        uint256 minOut;
        uint256 deadline;
        /// The only address allowed to land this swap (zero: anyone, and the fee goes to whoever lands it).
        address submitter;
        /// ETH paid to the submitter out of the swap, for carrying it.
        uint256 submitterFee;
        /// The new note's blinding, encrypted to its owner (its value is read from the Shrouded event).
        bytes encryptedNote;
    }

    event BoughtIntoNote(address indexed buyer, uint256 ethSpent, uint256 tokensOut, uint256 leafIndex);
    event Swapped(uint8 indexed fromAsset, address indexed submitter, uint256 amountIn, uint256 amountOut, uint256 submitterFee, uint256 leafIndex);

    error ZeroAmount();
    error NoMinimumOut();
    error TradingPaused();
    error PartialFill();
    error Slippage(uint256 out, uint256 minimum);
    error NotPoolManager();
    error UnexpectedEth();
    error PaymentFailed();
    error BadSwap();
    error SwapExpired();
    error NotSubmitter();
    error BadParameter();

    constructor(IPonsFactory factory_, IPoolManager poolManager_, OarkelPool pool_) {
        if (address(factory_).code.length == 0 || address(poolManager_).code.length == 0 || address(pool_).code.length == 0) {
            revert BadParameter();
        }
        factory = factory_;
        poolManager = poolManager_;
        pool = pool_;
        token = pool_.token();
    }

    /// ETH arrives only from the pool or the venue, while this contract is waiting for it.
    receive() external payable {
        if (!_expectingEth) revert UnexpectedEth();
    }

    /* ------------------------------------------------------------ buy */

    /**
     * @notice Buys $OARKEL with the attached ETH and shrouds all of it into one new note. ETH the curve could not
     * take (it stops at graduation) goes back to the buyer.
     * @param ownerHash Poseidon(ownerPk, blinding) of the new note, computed by the buyer's wallet.
     * @param minTokensOut Lowest acceptable $OARKEL amount (a buy without a floor can be sandwiched).
     * @param encryptedNote The note's blinding, encrypted to its owner.
     */
    function buy(uint256 ownerHash, uint256 minTokensOut, bytes calldata encryptedNote)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut, uint256 leafIndex)
    {
        if (msg.value == 0) revert ZeroAmount();
        uint256 refund;
        (tokensOut, refund) = _buyTokens(msg.value, minTokensOut);
        leafIndex = _shroud(ASSET_TOKEN, tokensOut, ownerHash, encryptedNote);
        emit BoughtIntoNote(msg.sender, msg.value - refund, tokensOut, leafIndex);
        if (refund != 0) _sendEth(msg.sender, refund);
    }

    /* ------------------------------------------------------------ swap */

    /**
     * @notice Lands a swap proof: unshrouds to this contract, trades on the Pons market, shrouds the result into a
     * new note of the other asset, and pays the submitter's ETH fee.
     */
    function swap(bytes calldata proof, OarkelPool.PublicArgs calldata args, OarkelPool.ExtData calldata ext)
        external
        nonReentrant
        returns (uint256 amountOut, uint256 leafIndex)
    {
        if (ext.recipient != address(this) || ext.relayer != address(this) || ext.relayerFee == 0) revert BadSwap();
        SwapTerms memory t = decodeSwapTerms(ext.encryptedOutput1);
        if (block.timestamp > t.deadline) revert SwapExpired();
        if (t.submitter != address(0) && msg.sender != t.submitter) revert NotSubmitter();

        uint256 amountIn;
        if (args.asset == ASSET_ETH) {
            uint256 before = address(this).balance;
            _expectingEth = true;
            pool.unshroud(proof, args, ext);
            _expectingEth = false;
            uint256 received = address(this).balance - before;
            if (received <= t.submitterFee) revert BadSwap();
            amountIn = received - t.submitterFee;
            uint256 refund;
            (amountOut, refund) = _buyTokens(amountIn, t.minOut);
            // Leftover ETH has no note to go to, so a buy the curve cannot fill whole waits for the v4 pool.
            if (refund != 0) revert PartialFill();
            leafIndex = _shroud(ASSET_TOKEN, amountOut, t.ownerHash, t.encryptedNote);
        } else if (args.asset == ASSET_TOKEN) {
            uint256 before = token.balanceOf(address(this));
            pool.unshroud(proof, args, ext);
            amountIn = token.balanceOf(address(this)) - before;
            uint256 ethOut = _sellTokens(amountIn, t.minOut + t.submitterFee);
            amountOut = ethOut - t.submitterFee;
            leafIndex = _shroud(ASSET_ETH, amountOut, t.ownerHash, t.encryptedNote);
        } else {
            revert BadSwap();
        }

        address payee = t.submitter == address(0) ? msg.sender : t.submitter;
        emit Swapped(args.asset, payee, amountIn, amountOut, t.submitterFee, leafIndex);
        if (t.submitterFee != 0) _sendEth(payee, t.submitterFee);
    }

    /// @notice Encodes swap terms the way `swap` expects them in the proof's second encrypted output.
    function encodeSwapTerms(SwapTerms memory t) public pure returns (bytes memory) {
        return abi.encodePacked(SWAP_MAGIC, abi.encode(t.ownerHash, t.minOut, t.deadline, t.submitter, t.submitterFee, t.encryptedNote));
    }

    function decodeSwapTerms(bytes calldata blob) public pure returns (SwapTerms memory t) {
        if (blob.length < 16 + 7 * 32 || bytes16(blob[:16]) != SWAP_MAGIC) revert BadSwap();
        (t.ownerHash, t.minOut, t.deadline, t.submitter, t.submitterFee, t.encryptedNote) =
            abi.decode(blob[16:], (uint256, uint256, uint256, address, uint256, bytes));
        if (t.minOut == 0) revert NoMinimumOut();
    }

    /* ------------------------------------------------------------ trading */

    /// Buys with `ethIn` on the live venue; returns tokens received and ETH the venue handed back.
    function _buyTokens(uint256 ethIn, uint256 minTokensOut) private returns (uint256 tokensOut, uint256 refund) {
        if (minTokensOut == 0) revert NoMinimumOut();
        PonsLaunchedToken memory l = factory.getLaunchedToken(address(token));
        uint256 tokensBefore = token.balanceOf(address(this));
        uint256 ethAfterSpend = address(this).balance - ethIn;
        _expectingEth = true;
        if (_curveOpen(l)) {
            // The curve fills up to its graduation allocation, refunds the rest and checks the minimum itself.
            IPonsCurve(l.curve).buy{value: ethIn}(ethIn, minTokensOut, address(this));
        } else if (l.phase == PHASE_POOL) {
            poolManager.unlock(abi.encode(true, _poolKey(l), ethIn, address(this)));
        } else {
            revert TradingPaused();
        }
        _expectingEth = false;
        tokensOut = token.balanceOf(address(this)) - tokensBefore;
        if (tokensOut < minTokensOut) revert Slippage(tokensOut, minTokensOut);
        refund = address(this).balance - ethAfterSpend;
    }

    /// Sells all of `amount` on the live venue and returns the ETH received.
    function _sellTokens(uint256 amount, uint256 minEthOut) private returns (uint256 ethOut) {
        if (amount == 0) revert ZeroAmount();
        PonsLaunchedToken memory l = factory.getLaunchedToken(address(token));
        uint256 ethBefore = address(this).balance;
        _expectingEth = true;
        if (_curveOpen(l)) {
            token.forceApprove(l.curve, amount);
            IPonsCurve(l.curve).sell(amount, minEthOut, address(this));
        } else if (l.phase == PHASE_POOL) {
            (, uint256 sold) = abi.decode(poolManager.unlock(abi.encode(false, _poolKey(l), amount, address(this))), (uint256, uint256));
            if (sold != amount) revert PartialFill();
        } else {
            revert TradingPaused();
        }
        _expectingEth = false;
        ethOut = address(this).balance - ethBefore;
        if (ethOut < minEthOut) revert Slippage(ethOut, minEthOut);
    }

    function _shroud(uint8 asset, uint256 amount, uint256 ownerHash, bytes memory encryptedNote) private returns (uint256 leafIndex) {
        leafIndex = pool.nextIndex();
        if (asset == ASSET_TOKEN) {
            token.forceApprove(address(pool), amount);
            pool.shroud(ASSET_TOKEN, amount, ownerHash, encryptedNote);
        } else {
            pool.shroud{value: amount}(ASSET_ETH, amount, ownerHash, encryptedNote);
        }
    }

    /* ------------------------------------------------------------ v4 */

    /// @dev Exact-input swap in the token's Uniswap v4 pool. ETH is currency0 (address zero sorts first).
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (bool isBuy, PoolKey memory key, uint256 amountIn, address recipient) = abi.decode(data, (bool, PoolKey, uint256, address));

        int256 delta = poolManager.swap(
            key,
            SwapParams({
                zeroForOne: isBuy,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: isBuy ? MIN_SQRT_PRICE_PLUS_ONE : MAX_SQRT_PRICE_MINUS_ONE
            }),
            ""
        );
        int128 amount0 = int128(delta >> 128);
        int128 amount1 = int128(delta);

        if (isBuy) {
            uint256 paid = uint256(uint128(-amount0));
            uint256 out = uint256(uint128(amount1));
            poolManager.settle{value: paid}();
            poolManager.take(key.currency1, recipient, out);
            return abi.encode(out, paid);
        }
        uint256 sold = uint256(uint128(-amount1));
        uint256 ethOut = uint256(uint128(amount0));
        poolManager.sync(key.currency1);
        IERC20(key.currency1).safeTransfer(address(poolManager), sold);
        poolManager.settle();
        poolManager.take(address(0), recipient, ethOut);
        return abi.encode(ethOut, sold);
    }

    /* ------------------------------------------------------------ internals */

    function _curveOpen(PonsLaunchedToken memory l) private view returns (bool) {
        return l.phase == PHASE_CURVE && !IPonsCurve(l.curve).graduated() && !IPonsCurve(l.curve).readyToGraduate();
    }

    function _poolKey(PonsLaunchedToken memory l) private view returns (PoolKey memory) {
        return PoolKey({currency0: address(0), currency1: address(token), fee: l.poolFee, tickSpacing: l.tickSpacing, hooks: factory.memeHook()});
    }

    function _sendEth(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }
}
