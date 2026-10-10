// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OarkelPool, IProofVerifier} from "../src/OarkelPool.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";
import {PoseidonT3} from "../src/poseidon/PoseidonT3.sol";
import {PoseidonT4} from "../src/poseidon/PoseidonT4.sol";

/// Shared harness: real verifier, real proofs from the site's TypeScript prover (via ffi),
/// and a local mirror of the tree's leaves.
abstract contract ZkBase is Test {
    string internal constant SIG_A =
        "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b";
    string internal constant SIG_B =
        "0x222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221c";

    OarkelPool internal pool;
    IProofVerifier internal verifier;
    uint256[] internal leaves;
    address internal feeSink = makeAddr("feeSink");
    address internal relayer = makeAddr("relayer");

    uint256 internal constant SHROUD_BPS = 25;
    uint256 internal constant TRANSFER_BPS = 10;
    uint256 internal constant FLAT_ETH = 0.0005 ether;
    uint256 internal constant FLAT_TOKEN = 20 ether;

    struct Note {
        uint8 asset;
        uint256 value;
        uint256 blinding;
        uint256 index;
    }

    struct Spend {
        bytes proof;
        OarkelPool.PublicArgs args;
        OarkelPool.ExtData ext;
        uint256[2] outValues;
        uint256[2] outBlindings;
        uint256[2] outPks;
    }

    function _deploy(IERC20 token) internal {
        verifier = IProofVerifier(address(new HonkVerifier()));
        pool = new OarkelPool(verifier, token, feeSink, SHROUD_BPS, TRANSFER_BPS, FLAT_ETH, FLAT_TOKEN);
    }

    function pkOf(string memory sig) internal returns (uint256) {
        string[] memory cmd = new string[](5);
        cmd[0] = "node";
        cmd[1] = "--no-warnings";
        cmd[2] = "test/ffi/zk.mts";
        cmd[3] = "pk";
        cmd[4] = sig;
        return abi.decode(vm.ffi(cmd), (uint256));
    }

    function ownerHashOf(string memory sig, uint256 blinding) internal returns (uint256) {
        return PoseidonT3.hash([pkOf(sig), blinding]);
    }

    /// Shrouds and mirrors the new leaf. Returns the note (value read back from the pool's accounting).
    function shroud(string memory sig, uint8 asset, uint256 amount, uint256 blinding) internal returns (Note memory n) {
        uint256 oh = ownerHashOf(sig, blinding);
        uint256 sharesBefore = pool.totalShares();
        if (asset == 0) {
            pool.shroud{value: amount}(0, amount, oh, hex"01");
            n.value = amount - (amount * SHROUD_BPS + 9999) / 10_000;
        } else {
            pool.shroud(1, amount, oh, hex"01");
            n.value = pool.totalShares() - sharesBefore;
        }
        n.asset = asset;
        n.blinding = blinding;
        n.index = leaves.length;
        leaves.push(PoseidonT4.hash([uint256(asset), n.value, oh]));
        assertEq(pool.getLastRoot(), _localRoot(), "local tree mirrors the pool");
    }

    function _localRoot() internal view returns (uint256) {
        // Recompute the root from the mirrored leaves (small trees only).
        uint256[] memory level = leaves;
        for (uint256 d = 0; d < 24; d++) {
            uint256[] memory up = new uint256[]((level.length + 1) / 2);
            for (uint256 i = 0; i < up.length; i++) {
                uint256 r = 2 * i + 1 < level.length ? level[2 * i + 1] : pool.zeros(d);
                up[i] = PoseidonT3.hash([level[2 * i], r]);
            }
            if (up.length == 0) return pool.zeros(24);
            level = up;
        }
        return level[0];
    }

    struct SpendInput {
        string sig;
        uint8 asset;
        Note[] notes;
        string paySig;
        uint256 payValue;
        uint256 exitValue;
        address recipient;
        address relayerAddr;
        uint256 relayerFee;
        /// OarkelSwap terms (hex bytes) for the second encrypted output; empty for ordinary spends.
        bytes swapTerms;
    }

    function prove(SpendInput memory s) internal returns (Spend memory out) {
        string memory notes = "[";
        for (uint256 i = 0; i < s.notes.length; i++) {
            notes = string.concat(
                notes,
                i == 0 ? "" : ",",
                '{"value":"',
                vm.toString(s.notes[i].value),
                '","blinding":"',
                vm.toString(s.notes[i].blinding),
                '","index":',
                vm.toString(s.notes[i].index),
                "}"
            );
        }
        notes = string.concat(notes, "]");
        string memory leafList = "[";
        for (uint256 i = 0; i < leaves.length; i++) {
            leafList = string.concat(leafList, i == 0 ? '"' : ',"', vm.toString(leaves[i]), '"');
        }
        leafList = string.concat(leafList, "]");
        string memory json = string.concat(
            '{"sig":"',
            s.sig,
            '","asset":',
            vm.toString(uint256(s.asset)),
            ',"notes":',
            notes,
            ',"leaves":',
            leafList,
            bytes(s.paySig).length > 0 ? string.concat(',"paySig":"', s.paySig, '","payValue":"', vm.toString(s.payValue), '"') : "",
            ',"exitValue":"',
            vm.toString(s.exitValue),
            '","feeBps":"',
            vm.toString(TRANSFER_BPS),
            '","recipient":"',
            vm.toString(s.recipient),
            '","relayer":"',
            vm.toString(s.relayerAddr),
            '","relayerFee":"',
            vm.toString(s.relayerFee),
            '","chainId":',
            vm.toString(block.chainid),
            ',"pool":"',
            vm.toString(address(pool)),
            '"'
        );
        json = string.concat(json, s.swapTerms.length > 0 ? string.concat(',"swapTerms":"', vm.toString(s.swapTerms), '"') : "", "}");
        string[] memory cmd = new string[](5);
        cmd[0] = "node";
        cmd[1] = "--no-warnings";
        cmd[2] = "test/ffi/zk.mts";
        cmd[3] = "spend";
        cmd[4] = json;
        bytes memory raw = vm.ffi(cmd);
        (bytes memory proof, uint256[8] memory pub, bytes memory enc0, bytes memory enc1, uint256[2] memory ov, uint256[2] memory ob, uint256[2] memory opk) =
            abi.decode(raw, (bytes, uint256[8], bytes, bytes, uint256[2], uint256[2], uint256[2]));
        out.proof = proof;
        out.args = OarkelPool.PublicArgs({
            root: pub[0],
            asset: uint8(pub[1]),
            nullifiers: [pub[2], pub[3]],
            commitments: [pub[4], pub[5]],
            exitValue: pub[6],
            transferFee: pub[7]
        });
        out.ext = OarkelPool.ExtData({recipient: s.recipient, relayer: s.relayerAddr, relayerFee: s.relayerFee, encryptedOutput0: enc0, encryptedOutput1: enc1});
        out.outValues = ov;
        out.outBlindings = ob;
        out.outPks = opk;
    }

    /// After a spend lands: mirror its two leaves and return the output owned by `sig` with the larger value.
    function landed(Spend memory sp, string memory sig) internal returns (Note memory mine) {
        uint256 pk = pkOf(sig);
        for (uint256 i = 0; i < 2; i++) {
            uint256 idx = leaves.length;
            leaves.push(sp.args.commitments[i]);
            if (sp.outPks[i] == pk && sp.outValues[i] >= mine.value) {
                mine = Note({asset: sp.args.asset, value: sp.outValues[i], blinding: sp.outBlindings[i], index: idx});
            }
        }
        assertEq(pool.getLastRoot(), _localRoot(), "local tree mirrors the pool");
    }

    function one(Note memory n) internal pure returns (Note[] memory a) {
        a = new Note[](1);
        a[0] = n;
    }

    function two(Note memory n, Note memory m) internal pure returns (Note[] memory a) {
        a = new Note[](2);
        a[0] = n;
        a[1] = m;
    }
}
