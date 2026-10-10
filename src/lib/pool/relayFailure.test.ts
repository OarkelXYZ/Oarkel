import { test } from "node:test";
import assert from "node:assert/strict";
import { RelayError, classifyRelayFailure } from "./relayFailure.ts";

test("unreachable, rate-limited and paused relayers are skipped", () => {
  assert.equal(classifyRelayFailure(new RelayError("The relayer could not be reached.", 0)), "unavailable");
  assert.equal(classifyRelayFailure(new RelayError("Too many requests.", 429)), "unavailable");
  assert.equal(classifyRelayFailure(new RelayError("The relayer is paused for a while. Submit from your wallet instead.", 503)), "unavailable");
  assert.equal(classifyRelayFailure(new RelayError("Gas estimate too high: 13000000 gas, this relayer stops at 12000000.", 400)), "unavailable");
  assert.equal(classifyRelayFailure(new Error("network")), "unavailable");
});

test("a moved quote or tree asks for a fresh proof", () => {
  assert.equal(classifyRelayFailure(new RelayError("Relayer fee too low: 1 wei offered, 2 wei needed at the current gas price.", 400)), "requote");
  assert.equal(classifyRelayFailure(new RelayError("The proof's root is no longer known. Prove again.", 400)), "requote");
  assert.equal(classifyRelayFailure(new RelayError("The transaction would fail now. Prove again.", 400)), "requote");
});

test("only a plain 400 can ask for a fresh proof", () => {
  assert.equal(classifyRelayFailure(new RelayError("Relayer fee too low.", 409)), "final");
  assert.equal(classifyRelayFailure(new RelayError("Relayer fee too low.", 502)), "unavailable");
});

test("a refusal of the spend itself stops", () => {
  assert.equal(classifyRelayFailure(new RelayError("A note in this proof is already spent.", 400)), "final");
  assert.equal(classifyRelayFailure(new RelayError("This note is already being relayed.", 409)), "final");
});
