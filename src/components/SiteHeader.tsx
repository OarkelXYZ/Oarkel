"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { List, X } from "@phosphor-icons/react";
import { CopyCaTag } from "@/components/CopyCa";
import { Wordmark } from "@/components/Mark";
import { NAV } from "@/components/site";
import { NavWallet } from "@/components/wallet/WalletButton";
import { BRAND } from "@/config/brand";

export function SiteHeader() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const active = (href: string) => (href.startsWith("/#") ? false : path === href || path.startsWith(`${href}/`));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="wrap flex h-16 items-center gap-3">
        <Link href="/" className="shrink-0" aria-label={`${BRAND.name} home`}>
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-[14px] whitespace-nowrap transition-colors ${
                active(item.href) ? "bg-card-2 text-fg" : "text-fg-2 hover:text-fg"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <CopyCaTag />
          <div className="hidden sm:block">
            <NavWallet />
          </div>
          <div className="sm:hidden">
            <NavWallet compact />
          </div>
          <Link href="/app" className="btn-ink hidden h-9 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap xl:inline-flex">
            Open app
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
            className="btn-ghost grid size-9 shrink-0 place-items-center rounded-full lg:hidden"
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {menu ? <PhoneMenu onClose={() => setMenu(false)} /> : null}
    </header>
  );
}

function PhoneMenu({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  // The header blurs what is behind it, which would trap a fixed child: portal to <body>.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-night/50" onClick={onClose} />
      <div className="enter absolute inset-x-0 top-0 border-b border-line bg-paper pb-6">
        <div className="wrap flex h-16 items-center justify-between">
          <Wordmark />
          <button type="button" aria-label="Close menu" onClick={onClose} className="btn-ghost grid size-9 place-items-center rounded-full">
            <X size={16} />
          </button>
        </div>
        <nav aria-label="Phone" className="wrap flex flex-col">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose} className="display border-b border-line py-3 text-[24px]">
              {item.label}
            </Link>
          ))}
          <Link href="/app" onClick={onClose} className="btn-ink mt-5 inline-flex h-11 items-center justify-center rounded-full text-[15px] font-semibold">
            Open the app (practice)
          </Link>
        </nav>
      </div>
    </div>,
    document.body,
  );
}
