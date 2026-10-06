"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, MagnifyingGlass } from "@phosphor-icons/react";

export type NavItem = { slug: string; href: string; nav: string; group: string; h1: string };

/** Docs sidebar: a filter box (Ctrl K / ⌘K) over the grouped page list. */
export function DocsSidebar({ items, current }: { items: NavItem[]; current: string }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((d) => `${d.nav} ${d.h1} ${d.group}`.toLowerCase().includes(t)) : items;
  }, [q, items]);
  const groups = [...new Set(shown.map((d) => d.group))];
  return (
    <div>
      <label className="docs-search">
        <MagnifyingGlass size={14} aria-hidden="true" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search the docs" />
        <span className="docs-kbd hidden xl:inline">Ctrl K / ⌘K</span>
      </label>
      <nav aria-label="Docs pages" className="mt-6">
        {groups.length === 0 ? <p className="px-3 text-[13px] text-fg-3">No page matches “{q}”.</p> : null}
        {groups.map((g, gi) => (
          <div key={g}>
            {gi > 0 || g !== "Overview" ? <p className="docs-side-section">{g}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {shown
                .filter((d) => d.group === g)
                .map((d) => (
                  <li key={d.slug}>
                    <Link href={d.href} aria-current={d.slug === current ? "page" : undefined} className="docs-side-link">
                      {d.nav}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

/** "On this page" list that follows the reader. */
export function DocsToc({ items }: { items: { id: string; h: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const pick = () => {
      let cur = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top < 140) cur = it.id;
      }
      setActive(cur);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => window.removeEventListener("scroll", pick);
  }, [items]);
  return (
    <nav aria-label="On this page">
      <p className="font-mono text-[10.5px] tracking-[0.3em] text-white/45 uppercase">On this page</p>
      <ul className="mt-4">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className={`docs-toc-link ${active === it.id ? "is-active" : ""}`}>
              {it.h}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Copies the article as plain text, for pasting into notes or an assistant. */
export function CopyPage() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="docs-chip"
      onClick={async () => {
        const text = document.querySelector("article")?.innerText ?? "";
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : "Copy page text"}
    </button>
  );
}
