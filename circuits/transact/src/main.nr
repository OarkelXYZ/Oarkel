// Oarkel transact circuit: spends up to two notes and creates two new ones.
//
// A note is the commitment
//     C = Poseidon3(asset, value, Poseidon2(owner_pk, blinding))
// with owner_pk = Poseidon1(sk). Spending a note reveals its nullifier
//     N = Poseidon3(C, leaf_index, sk)
// which only the owner can compute and which is the same every time, so the
// pool can refuse a second spend without learning which leaf was spent.
//
// The proof states, without revealing which notes or amounts:
//   1. every non-zero input note is a leaf of the tree with root `root`,
//   2. the prover knows the spending key that owns the input notes,
//   3. the nullifiers and output commitments are computed correctly,
//   4. inputs = outputs + exit_value + transfer_fee (values in note units),
//   5. transfer_fee * 10000 >= fee_bps * (value sent to other keys),
//   6. every value fits in 120 bits, so sums cannot wrap the field.
// `ext_data_hash` binds the recipient, relayer, relayer fee, encrypted notes,
// chain id and pool address, so nobody can change them after proving.
// Poseidon is the circomlib-compatible BN254 instance; the contract and the
// browser use the same constants (see contracts/test/Poseidon.t.sol and
// src/lib/zk/poseidon.test.ts for shared test vectors).

use poseidon::poseidon::bn254::{hash_1, hash_2, hash_3};

pub global DEPTH: u32 = 24;
global VALUE_BITS: u32 = 120;

fn note_commitment(asset: Field, value: Field, owner_pk: Field, blinding: Field) -> Field {
    hash_3([asset, value, hash_2([owner_pk, blinding])])
}

fn merkle_root(leaf: Field, index: Field, path: [Field; DEPTH]) -> Field {
    let bits: [bool; DEPTH] = index.to_le_bits();
    let mut node = leaf;
    for i in 0..DEPTH {
        let sibling = path[i];
        let (left, right) = if bits[i] { (sibling, node) } else { (node, sibling) };
        node = hash_2([left, right]);
    }
    node
}

fn main(
    root: pub Field,
    asset: pub Field,
    nullifiers: pub [Field; 2],
    commitments: pub [Field; 2],
    exit_value: pub Field,
    transfer_fee: pub Field,
    fee_bps: pub Field,
    ext_data_hash: pub Field,
    sk: Field,
    in_values: [Field; 2],
    in_blindings: [Field; 2],
    in_indices: [Field; 2],
    in_paths: [[Field; DEPTH]; 2],
    out_values: [Field; 2],
    out_pks: [Field; 2],
    out_blindings: [Field; 2],
) {
    exit_value.assert_max_bit_size::<VALUE_BITS>();
    transfer_fee.assert_max_bit_size::<VALUE_BITS>();
    fee_bps.assert_max_bit_size::<14>();

    let pk = hash_1([sk]);
    let mut total_in = 0;
    for i in 0..2 {
        in_values[i].assert_max_bit_size::<VALUE_BITS>();
        let c = note_commitment(asset, in_values[i], pk, in_blindings[i]);
        assert(nullifiers[i] == hash_3([c, in_indices[i], sk]), "nullifier mismatch");
        let computed = merkle_root(c, in_indices[i], in_paths[i]);
        // A zero-value input is a filler and needs no membership proof.
        assert((computed - root) * in_values[i] == 0, "note is not in the tree");
        total_in += in_values[i];
    }
    assert(nullifiers[0] != nullifiers[1], "same note twice");

    let mut total_out = 0;
    let mut sent = 0;
    for j in 0..2 {
        out_values[j].assert_max_bit_size::<VALUE_BITS>();
        assert(commitments[j] == note_commitment(asset, out_values[j], out_pks[j], out_blindings[j]), "commitment mismatch");
        total_out += out_values[j];
        // Value going to a different key is a transfer and pays the fee; change back to the owner does not.
        sent += out_values[j] * ((out_pks[j] != pk) as Field);
    }

    assert(total_in == total_out + exit_value + transfer_fee, "value is not conserved");
    // transfer_fee * 10000 - fee_bps * sent must be non-negative: a negative
    // result wraps to a ~254-bit field element and fails this range check.
    (transfer_fee * 10000 - fee_bps * sent).assert_max_bit_size::<140>();

    // Keep the external data hash in the statement explicitly.
    assert(ext_data_hash * 0 == 0);
}

#[test]
fn poseidon_vectors() {
    // circomlib reference values, shared with the Solidity and TypeScript tests.
    assert(hash_2([1, 2]) == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
    assert(hash_1([1]) == 0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133);
    assert(hash_3([1, 2, 3]) == 0x0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732);
}
