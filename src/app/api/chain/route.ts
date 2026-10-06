import { NextResponse } from "next/server";
import { chainSnapshot } from "@/lib/feeds/chain";
import { allowNetwork, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Live Robinhood Chain status (block, gas, ETH/USD, token supply once live). */
export async function GET(request: Request) {
  if (!(await allowNetwork(request, "chain", 120, 60))) return tooMany();
  const snap = await chainSnapshot();
  return NextResponse.json(snap, { headers: { "cache-control": "no-store" } });
}
