"use client";

import { useState } from "react";
import { BRAND } from "@/config/brand";

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Worked example of the share arithmetic. Every number here is an input the
 * visitor picks, not a reading of a live pool (there is no live pool yet).
 */
export function YieldExample() {
  const [vault, setVault] = useState(2_000_000);
  const [mine, setMine] = useState(50_000);
  const [fees, setFees] = useState(40_000);

  // Shares were minted 1:1 when the vault opened; fees raise the backing per share.
  const shares = vault;
  const perShare = (vault + fees) / shares;
  const myShares = (mine / vault) * shares;
  const after = myShares * perShare;
  const gain = after - mine;

  return (
    <div className="tile p-5 md:p-6" data-testid="yield-example">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-fg-3">Worked example</p>
        <p className="text-[12.5px] text-fg-3">Your own inputs. Not a forecast, not live data.</p>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5">
        <Slider label={`Shrouded ${BRAND.symbol} in the vault`} value={vault} min={500_000} max={10_000_000} step={100_000} onChange={setVault} />
        <Slider label="Your note" value={mine} min={1_000} max={Math.min(500_000, vault)} step={1_000} onChange={setMine} />
        <Slider label="Fees that reach the vault" value={fees} min={0} max={400_000} step={5_000} onChange={setFees} />
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-line pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-[12.5px] text-fg-3">Value per share</dt>
          <dd className="num mt-1 text-[20px] text-fg">{fmt(perShare, 4)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-fg-3">Your note after</dt>
          <dd className="num mt-1 text-[20px] text-fg">{fmt(after)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-fg-3">Earned by holding</dt>
          <dd className="num mt-1 text-[20px] text-up">+{fmt(gain)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-[13px] leading-relaxed text-fg-3">
        The same {fmt(fees)} {BRAND.symbol} in fees pays a public wallet nothing. A public holder of {fmt(mine)} {BRAND.symbol} still holds{" "}
        {fmt(mine)} afterwards.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
        <span className="text-fg-2">{label}</span>
        <span className="num text-fg">{fmt(Math.min(value, max))}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#b83c1c]"
      />
    </label>
  );
}
