import { NextResponse } from "next/server";
import { getStore } from "@/lib/auth/store";
import { allowNetwork, tooMany } from "@/lib/guard";
import { RULES, accountView, readStats } from "@/lib/practice/ledger";

export const dynamic = "force-dynamic";

/**
 * A wallet's practice account, notes and the shared practice vault. Practice
 * data is not secret (it is a rehearsal, not a private pool), so it is
 * readable without a signature; changing it always needs one.
 */
export async function GET(request: Request) {
  if (!(await allowNetwork(request, "account", 90, 60))) return tooMany();
  const store = getStore();
  if (!store) return NextResponse.json({ configured: false });
  const address = (new URL(request.url).searchParams.get("address") ?? "").toLowerCase();
  if (!address) {
    return NextResponse.json({ configured: true, stats: await readStats(store) }, { headers: { "cache-control": "no-store" } });
  }
  if (!/^0x[0-9a-f]{40}$/.test(address)) return NextResponse.json({ error: "A wallet address is required." }, { status: 400 });
  const view = await accountView(store, address);
  const rules = {
    shroudBps: Number(RULES.shroudBps),
    transferBps: Number(RULES.transferBps),
    unshroudFlat: RULES.unshroudFlat,
    min: RULES.min,
    oarkelPerEth: RULES.oarkelPerEth,
  };
  return NextResponse.json({ configured: true, ...view, rules }, { headers: { "cache-control": "no-store" } });
}
