import { NextResponse } from "next/server";
import { poolLeaves } from "@/lib/feeds/poolLeaves";
import { allowNetwork, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

const PAGE = 2000;

/** Public pool leaves (commitments + encrypted notes), paged by leaf index. */
export async function GET(request: Request) {
  if (!(await allowNetwork(request, "leaves", 240, 60))) return tooMany();
  const from = Number(new URL(request.url).searchParams.get("from") ?? "0");
  if (!Number.isSafeInteger(from) || from < 0) return NextResponse.json({ error: "Bad from" }, { status: 400 });
  const data = await poolLeaves(from, PAGE);
  if (!data) return NextResponse.json({ configured: false }, { headers: { "cache-control": "no-store" } });
  return NextResponse.json({ configured: true, from, ...data }, { headers: { "cache-control": "no-store" } });
}
