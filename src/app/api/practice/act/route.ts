import { NextResponse } from "next/server";
import { getStore } from "@/lib/auth/store";
import { allow, allowNetwork, readBody, tooMany } from "@/lib/guard";
import { consumeIntent } from "@/lib/practice/intent";
import { join, readAccount, send, shroud, topUp, unshroud } from "@/lib/practice/ledger";

export const dynamic = "force-dynamic";

/** Step 2: the signed message comes back. The nonce is burned before anything runs. */
export async function POST(request: Request) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "not_configured", message: "Practice storage is not configured on this site yet." }, { status: 503 });
  if (!(await allowNetwork(request, "act-ip", 40, 60))) return tooMany();
  const body = await readBody<{ nonce?: unknown; signature?: unknown }>(request, 1024);
  if ("response" in body) return body.response;
  const nonce = typeof body.data.nonce === "string" ? body.data.nonce : "";
  const signature = typeof body.data.signature === "string" ? body.data.signature : "";
  const consumed = await consumeIntent(store, nonce, signature);
  if ("error" in consumed) return NextResponse.json({ error: consumed.error }, { status: consumed.status });
  const { address, action } = consumed;
  if (!(await allow(store, "act", [address], 20, 60))) return tooMany();
  // Bounded growth: each proven wallet gets a daily action budget, and new practice accounts
  // (the only action that creates a record) are capped per network per day, checked after the signature.
  if (!(await allow(store, "act-day", [address], 300, 86_400))) return tooMany();
  if (action.kind === "join" && !(await readAccount(store, address))) {
    if (!(await allowNetwork(request, "join-net", 30, 86_400)) || !(await allow(store, "join-wallet", [address], 20, 86_400))) return tooMany();
  }
  const result =
    action.kind === "join"
      ? await join(store, address)
      : action.kind === "topup"
        ? await topUp(store, address)
        : action.kind === "shroud"
          ? await shroud(store, address, action.asset, action.amount)
          : action.kind === "send"
            ? await send(store, address, action.asset, action.amount, action.to)
            : await unshroud(store, address, action.asset, action.amount, action.to, action.relayer);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
