// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PoseidonT3} from "./poseidon/PoseidonT3.sol";
import {PoseidonT4} from "./poseidon/PoseidonT4.sol";

interface IProofVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/**
 * @title OarkelPool
 * @notice A private pool for ETH and one ERC-20 ($OARKEL) on Robinhood Chain.
 *
 * Balances live as notes: Poseidon commitments in an append-only Merkle
 * tree. A note is spent with a zero-knowledge proof (circuits/transact) that
 * shows ownership and membership without saying which leaf it is; the
 * nullifier stops a second spend.
 *
 *   shroud    public ETH or $OARKEL in, one new note out. The pool computes
 *             the commitment itself from the public amount, so a deposit can
 *             never claim more than it paid.
 *   transact  private send: two notes in, two notes out, optional relayer
 *             paid from the notes. Value sent to another key pays the
 *             transfer fee (enforced inside the proof).
 *   unshroud  notes in, public ETH or $OARKEL out to any address, with an
 *             optional relayer fee and a flat protocol fee.
 *
 * A spend that pays a relayer must be sent by that relayer (the proof binds
 * its address); a spend without a relayer fee can be sent by anyone.
 *
 * $OARKEL notes are denominated in vault shares, not tokens. Fees paid in
 * $OARKEL, and donations, raise the value of every share, so shrouded
 * $OARKEL earns. ETH fees accrue to `feeSink`, an address fixed at deploy,
 * which is expected to buy $OARKEL and `donate` it back.
 *
 * There is no owner, no admin function, no pause, no proxy and no upgrade
 * path. Every parameter is fixed in the constructor.
 */
contract OarkelPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ------------------------------------------------------------ constants */

    /// BN254 scalar field order. Every public input must be below it.
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant TREE_DEPTH = 24;
    uint256 public constant ROOT_HISTORY = 100;
    /// Note values (wei or shares) must fit in 120 bits; the circuit checks the same bound.
    uint256 public constant MAX_VALUE = (1 << 120) - 1;
    /// Virtual shares and virtual token for the vault, against first-depositor inflation.
    uint256 public constant VIRTUAL_SHARES = 1e6;
    uint256 public constant MAX_NOTE_BYTES = 512;
    uint256 public constant MAX_FEE_BPS = 500;

    uint8 public constant ASSET_ETH = 0;
    uint8 public constant ASSET_TOKEN = 1;

    /* ------------------------------------------------------------ immutables */

    IProofVerifier public immutable verifier;
    IERC20 public immutable token;
    address public immutable feeSink;
    uint256 public immutable shroudFeeBps;
    uint256 public immutable transferFeeBps;
    uint256 public immutable unshroudFeeEth;
    uint256 public immutable unshroudFeeToken;

    /* ------------------------------------------------------------ state */

    uint256 public nextIndex;
    uint256 public currentRootIndex;
    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public roots;
    mapping(uint256 => bool) public nullifierSpent;

    /// Vault: `backing` tokens stand behind `totalShares` shares held in notes.
    uint256 public totalShares;
    uint256 public backing;
    /// Token yield that arrived while no shares existed; joins the backing with the next shares.
    uint256 public pendingYield;
    /// ETH fees waiting for `sweepEthFees`.
    uint256 public ethFees;

    /* ------------------------------------------------------------ types */

    struct PublicArgs {
        uint256 root;
        uint8 asset;
        uint256[2] nullifiers;
        uint256[2] commitments;
        /// Note units leaving the pool: wei for ETH, shares for the token.
        uint256 exitValue;
        /// Note units paid as the private transfer fee.
        uint256 transferFee;
    }

    struct ExtData {
        address recipient;
        address relayer;
        /// In wei for ETH, in token units for the token.
        uint256 relayerFee;
        bytes encryptedOutput0;
        bytes encryptedOutput1;
    }

    /* ------------------------------------------------------------ events */

    event NewCommitment(uint256 indexed commitment, uint256 indexed leafIndex, bytes encryptedNote);
    event NewNullifier(uint256 indexed nullifier);
    event Shrouded(uint8 indexed asset, address indexed from, uint256 amount, uint256 fee, uint256 noteValue, uint256 leafIndex);
    event PrivateTransfer(uint8 indexed asset, uint256 transferFee, address indexed relayer, uint256 relayerPaid);
    event Unshrouded(
        uint8 indexed asset, address indexed recipient, address indexed relayer, uint256 amountOut, uint256 relayerPaid, uint256 protocolFee
    );
    event YieldAdded(uint256 amount, uint256 totalShares, uint256 backing);
    event SharesBurned(uint256 shares, uint256 totalShares);
    event EthFeeAccrued(uint256 amount);
    event Donated(address indexed from, uint256 amount);
    event EthFeesSwept(address indexed to, uint256 amount);

    /* ------------------------------------------------------------ errors */

    error BadParameter();
    error BadAsset();
    error BadAmount();
    error NoteTooLarge();
    error NotInField();
    error ValueTooLarge();
    error FeeOnTransferToken();
    error ZeroShares();
    error TreeFull();
    error UnknownRoot();
    error NullifierSpent();
    error SameNullifier();
    error InvalidProof();
    error BadRecipient();
    error BadRelayer();
    error ExitTooSmall();
    error EthTransferFailed();
    error NothingToSweep();
    error NotRelayer();

    /* ------------------------------------------------------------ constructor */

    constructor(
        IProofVerifier verifier_,
        IERC20 token_,
        address feeSink_,
        uint256 shroudFeeBps_,
        uint256 transferFeeBps_,
        uint256 unshroudFeeEth_,
        uint256 unshroudFeeToken_
    ) {
        if (address(verifier_).code.length == 0 || address(token_).code.length == 0) revert BadParameter();
        if (feeSink_ == address(0)) revert BadParameter();
        if (shroudFeeBps_ > MAX_FEE_BPS || transferFeeBps_ > MAX_FEE_BPS) revert BadParameter();
        if (unshroudFeeEth_ > MAX_VALUE || unshroudFeeToken_ > MAX_VALUE) revert BadParameter();
        verifier = verifier_;
        token = token_;
        feeSink = feeSink_;
        shroudFeeBps = shroudFeeBps_;
        transferFeeBps = transferFeeBps_;
        unshroudFeeEth = unshroudFeeEth_;
        unshroudFeeToken = unshroudFeeToken_;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = zeros(i);
        }
        roots[0] = zeros(TREE_DEPTH);
    }

    /* ------------------------------------------------------------ shroud */

    /**
     * @notice Moves public ETH or $OARKEL into a new private note.
     * @param asset 0 for ETH (send `amount` as value), 1 for the token (approve first).
     * @param ownerHash Poseidon(ownerPk, blinding) of the new note, computed by the wallet.
     * @param encryptedNote The note's blinding, encrypted to its owner, so their wallet can find it.
     */
    function shroud(uint8 asset, uint256 amount, uint256 ownerHash, bytes calldata encryptedNote) external payable nonReentrant {
        if (ownerHash >= FIELD_SIZE) revert NotInField();
        if (encryptedNote.length > MAX_NOTE_BYTES) revert NoteTooLarge();
        if (amount == 0) revert BadAmount();

        uint256 fee;
        uint256 noteValue;
        if (asset == ASSET_ETH) {
            if (msg.value != amount) revert BadAmount();
            fee = _bpsFee(amount, shroudFeeBps);
            noteValue = amount - fee;
            _accrueEth(fee);
        } else if (asset == ASSET_TOKEN) {
            if (msg.value != 0) revert BadAmount();
            uint256 received = _pullToken(amount);
            fee = _bpsFee(received, shroudFeeBps);
            noteValue = _mintShares(received - fee);
            _addYield(fee);
        } else {
            revert BadAsset();
        }
        if (noteValue == 0) revert BadAmount();
        if (noteValue > MAX_VALUE) revert ValueTooLarge();

        uint256 commitment = PoseidonT4.hash([uint256(asset), noteValue, ownerHash]);
        uint256 index = _insert(commitment);
        emit NewCommitment(commitment, index, encryptedNote);
        emit Shrouded(asset, msg.sender, amount, fee, noteValue, index);
    }

    /* ------------------------------------------------------------ spend */

    /**
     * @notice Private send. `ext.recipient` must be zero; any exit value pays the relayer only.
     */
    function transact(bytes calldata proof, PublicArgs calldata args, ExtData calldata ext) external nonReentrant {
        if (ext.recipient != address(0)) revert BadRecipient();
        // A spend that pays a relayer can only be landed by that relayer, so nobody can race it
        // with the same proof and leave the relayer paying for a reverted transaction.
        if (args.exitValue > 0 && msg.sender != ext.relayer) revert NotRelayer();
        uint256 gross = _spend(proof, args, ext);
        if (gross < ext.relayerFee) revert ExitTooSmall();
        if (gross > 0 && ext.relayer == address(0)) revert BadRelayer();
        _pay(args.asset, ext.relayer, gross);
        emit PrivateTransfer(args.asset, args.transferFee, ext.relayer, gross);
    }

    /**
     * @notice Moves value out of the pool to any address. The flat protocol fee and the relayer fee come out of the exit.
     */
    function unshroud(bytes calldata proof, PublicArgs calldata args, ExtData calldata ext) external nonReentrant {
        if (ext.recipient == address(0)) revert BadRecipient();
        if (args.exitValue == 0) revert BadAmount();
        if (ext.relayerFee > 0 && ext.relayer == address(0)) revert BadRelayer();
        if (ext.relayerFee > 0 && msg.sender != ext.relayer) revert NotRelayer();
        uint256 gross = _spend(proof, args, ext);
        uint256 flat = args.asset == ASSET_ETH ? unshroudFeeEth : unshroudFeeToken;
        if (gross < flat + ext.relayerFee) revert ExitTooSmall();
        uint256 out = gross - flat - ext.relayerFee;

        if (args.asset == ASSET_ETH) _accrueEth(flat);
        else _addYield(flat);

        if (ext.relayerFee > 0) _pay(args.asset, ext.relayer, ext.relayerFee);
        _pay(args.asset, ext.recipient, out);
        emit Unshrouded(args.asset, ext.recipient, ext.relayer, out, ext.relayerFee, flat);
    }

    /* ------------------------------------------------------------ yield */

    /// @notice Adds $OARKEL to the vault backing without minting shares: every shrouded share gains.
    function donate(uint256 amount) external nonReentrant {
        if (amount == 0) revert BadAmount();
        uint256 received = _pullToken(amount);
        _addYield(received);
        emit Donated(msg.sender, received);
    }

    /// @notice Sends accrued ETH fees to `feeSink`. Anyone can call it.
    function sweepEthFees() external nonReentrant {
        uint256 amount = ethFees;
        if (amount == 0) revert NothingToSweep();
        ethFees = 0;
        _sendEth(feeSink, amount);
        emit EthFeesSwept(feeSink, amount);
    }

    /* ------------------------------------------------------------ views */

    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        uint256 i = currentRootIndex;
        for (uint256 n = 0; n < ROOT_HISTORY; n++) {
            if (roots[i] == root) return true;
            i = i == 0 ? ROOT_HISTORY - 1 : i - 1;
        }
        return false;
    }

    function getLastRoot() external view returns (uint256) {
        return roots[currentRootIndex];
    }

    function spentMany(uint256[] calldata nullifiers) external view returns (bool[] memory out) {
        out = new bool[](nullifiers.length);
        for (uint256 i = 0; i < nullifiers.length; i++) {
            out[i] = nullifierSpent[nullifiers[i]];
        }
    }

    /// @notice Token value of `shares` right now (rounded down), before any unshroud fee.
    function valueOfShares(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, backing + 1, totalShares + VIRTUAL_SHARES);
    }

    /// @notice Shares a token shroud of `amount` would receive now (after the shroud fee).
    function previewShroudShares(uint256 amount) external view returns (uint256) {
        uint256 net = amount - _bpsFee(amount, shroudFeeBps);
        (uint256 b, ) = _effectiveBacking();
        return Math.mulDiv(net, totalShares + VIRTUAL_SHARES, b + 1);
    }

    /// @notice Everything the app shows in one call.
    function state()
        external
        view
        returns (uint256 leaves, uint256 lastRoot, uint256 shares, uint256 vaultBacking, uint256 pending, uint256 ethFeesAccrued)
    {
        return (nextIndex, roots[currentRootIndex], totalShares, backing, pendingYield, ethFees);
    }

    /// @notice Hash that binds `ext` to a proof; the circuit takes it as a public input.
    function extDataHash(ExtData calldata ext) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), ext))) % FIELD_SIZE;
    }

    /// @notice Empty-subtree hashes: zeros(0) = 0, zeros(i + 1) = Poseidon(zeros(i), zeros(i)).
    function zeros(uint256 i) public pure returns (uint256) {
        if (i == 0) return 0;
        if (i == 1) return 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864;
        if (i == 2) return 0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1;
        if (i == 3) return 0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238;
        if (i == 4) return 0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a;
        if (i == 5) return 0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55;
        if (i == 6) return 0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78;
        if (i == 7) return 0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d;
        if (i == 8) return 0x2fa5e5f18f6027a6501bec864564472a616b2e274a41211a444cbe3a99f3cc61;
        if (i == 9) return 0x0e884376d0d8fd21ecb780389e941f66e45e7acce3e228ab3e2156a614fcd747;
        if (i == 10) return 0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2;
        if (i == 11) return 0x1f8d8822725e36385200c0b201249819a6e6e1e4650808b5bebc6bface7d7636;
        if (i == 12) return 0x2c5d82f66c914bafb9701589ba8cfcfb6162b0a12acf88a8d0879a0471b5f85a;
        if (i == 13) return 0x14c54148a0940bb820957f5adf3fa1134ef5c4aaa113f4646458f270e0bfbfd0;
        if (i == 14) return 0x190d33b12f986f961e10c0ee44d8b9af11be25588cad89d416118e4bf4ebe80c;
        if (i == 15) return 0x22f98aa9ce704152ac17354914ad73ed1167ae6596af510aa5b3649325e06c92;
        if (i == 16) return 0x2a7c7c9b6ce5880b9f6f228d72bf6a575a526f29c66ecceef8b753d38bba7323;
        if (i == 17) return 0x2e8186e558698ec1c67af9c14d463ffc470043c9c2988b954d75dd643f36b992;
        if (i == 18) return 0x0f57c5571e9a4eab49e2c8cf050dae948aef6ead647392273546249d1c1ff10f;
        if (i == 19) return 0x1830ee67b5fb554ad5f63d4388800e1cfe78e310697d46e43c9ce36134f72cca;
        if (i == 20) return 0x2134e76ac5d21aab186c2be1dd8f84ee880a1e46eaf712f9d371b6df22191f3e;
        if (i == 21) return 0x19df90ec844ebc4ffeebd866f33859b0c051d8c958ee3aa88f8f8df3db91a5b1;
        if (i == 22) return 0x18cca2a66b5c0787981e69aefd84852d74af0e93ef4912b4648c05f722efe52b;
        if (i == 23) return 0x2388909415230d1b4d1304d2d54f473a628338f2efad83fadf05644549d2538d;
        if (i == 24) return 0x27171fb4a97b6cc0e9e8f543b5294de866a2af2c9c8d0b1d96e673e4529ed540;
        revert BadParameter();
    }

    /* ------------------------------------------------------------ internals */

    /// Checks and verifies a spend, records nullifiers and new notes, applies the
    /// transfer fee, and returns the gross exit in wei or token units.
    function _spend(bytes calldata proof, PublicArgs calldata args, ExtData calldata ext) internal returns (uint256 gross) {
        if (args.asset > ASSET_TOKEN) revert BadAsset();
        if (ext.encryptedOutput0.length > MAX_NOTE_BYTES || ext.encryptedOutput1.length > MAX_NOTE_BYTES) revert NoteTooLarge();
        if (args.exitValue > MAX_VALUE || args.transferFee > MAX_VALUE) revert ValueTooLarge();
        if (!isKnownRoot(args.root)) revert UnknownRoot();
        for (uint256 i = 0; i < 2; i++) {
            if (args.nullifiers[i] >= FIELD_SIZE || args.commitments[i] >= FIELD_SIZE) revert NotInField();
            if (nullifierSpent[args.nullifiers[i]]) revert NullifierSpent();
        }
        if (args.nullifiers[0] == args.nullifiers[1]) revert SameNullifier();

        bytes32[] memory inputs = new bytes32[](10);
        inputs[0] = bytes32(args.root);
        inputs[1] = bytes32(uint256(args.asset));
        inputs[2] = bytes32(args.nullifiers[0]);
        inputs[3] = bytes32(args.nullifiers[1]);
        inputs[4] = bytes32(args.commitments[0]);
        inputs[5] = bytes32(args.commitments[1]);
        inputs[6] = bytes32(args.exitValue);
        inputs[7] = bytes32(args.transferFee);
        inputs[8] = bytes32(transferFeeBps);
        inputs[9] = bytes32(extDataHash(ext));
        // The generated verifier reverts on most bad proofs; report every failure the same way.
        try verifier.verify(proof, inputs) returns (bool ok) {
            if (!ok) revert InvalidProof();
        } catch {
            revert InvalidProof();
        }

        for (uint256 i = 0; i < 2; i++) {
            nullifierSpent[args.nullifiers[i]] = true;
            emit NewNullifier(args.nullifiers[i]);
        }
        uint256 i0 = _insert(args.commitments[0]);
        emit NewCommitment(args.commitments[0], i0, ext.encryptedOutput0);
        uint256 i1 = _insert(args.commitments[1]);
        emit NewCommitment(args.commitments[1], i1, ext.encryptedOutput1);

        if (args.asset == ASSET_ETH) {
            _accrueEth(args.transferFee);
            gross = args.exitValue;
        } else {
            // Gross is priced before the fee shares are burned, so the fee benefits the remaining holders only.
            gross = args.exitValue == 0 ? 0 : valueOfShares(args.exitValue);
            totalShares -= args.exitValue + args.transferFee;
            backing -= gross;
            if (args.transferFee > 0) emit SharesBurned(args.transferFee, totalShares);
        }
    }

    function _insert(uint256 leaf) internal returns (uint256 index) {
        index = nextIndex;
        if (index >= (1 << TREE_DEPTH)) revert TreeFull();
        uint256 node = leaf;
        uint256 at = index;
        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            uint256 left;
            uint256 right;
            if (at & 1 == 0) {
                left = node;
                right = zeros(level);
                filledSubtrees[level] = node;
            } else {
                left = filledSubtrees[level];
                right = node;
            }
            node = PoseidonT3.hash([left, right]);
            at >>= 1;
        }
        uint256 next = (currentRootIndex + 1) % ROOT_HISTORY;
        currentRootIndex = next;
        roots[next] = node;
        nextIndex = index + 1;
    }

    /// Mints shares for `net` tokens at the current price; pending yield joins the backing afterwards.
    function _mintShares(uint256 net) internal returns (uint256 shares) {
        (uint256 b, uint256 pending) = _effectiveBacking();
        shares = Math.mulDiv(net, totalShares + VIRTUAL_SHARES, b + 1);
        if (shares == 0) revert ZeroShares();
        backing = b + net + pending;
        pendingYield = 0;
        totalShares += shares;
    }

    /// With no shares outstanding, any leftover backing is treated as pending yield.
    function _effectiveBacking() internal view returns (uint256 b, uint256 pending) {
        if (totalShares == 0) return (0, pendingYield + backing);
        return (backing, pendingYield);
    }

    function _addYield(uint256 amount) internal {
        if (amount == 0) return;
        if (totalShares == 0) pendingYield += amount;
        else backing += amount;
        emit YieldAdded(amount, totalShares, backing);
    }

    function _accrueEth(uint256 amount) internal {
        if (amount == 0) return;
        ethFees += amount;
        emit EthFeeAccrued(amount);
    }

    function _pullToken(uint256 amount) internal returns (uint256 received) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        received = token.balanceOf(address(this)) - before;
        if (received != amount) revert FeeOnTransferToken();
    }

    function _pay(uint8 asset, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (asset == ASSET_ETH) _sendEth(to, amount);
        else token.safeTransfer(to, amount);
    }

    function _sendEth(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    /// Basis-point fee, rounded up so a non-zero amount never pays zero.
    function _bpsFee(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return Math.mulDiv(amount, bps, 10_000, Math.Rounding.Ceil);
    }
}
