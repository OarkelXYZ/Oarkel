"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { CopyCaTag } from "@/components/CopyCa";
import { Wordmark } from "@/components/Mark";
import { APP_NAV, NAV } from "@/components/site";
import { NavWallet } from "@/components/wallet/WalletButton";
import { BRAND, CHAIN } from "@/config/brand";

/** Which home section is under the header, for the in-page nav marker. */
function useHomeSection(enabled: boolean) {
  const [section, setSection] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const ids = NAV.flatMap((n) => ("section" in n ? [n.section] : []));
    const pick = () => {
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = id;
      }
      setSection(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => window.removeEventListener("scroll", pick);
  }, [enabled]);
  return enabled ? section : null;
}

export function SiteHeader() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const inApp = path === "/app" || path.startsWith("/app/");
  const section = useHomeSection(path === "/");

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const current = (item: (typeof NAV)[number]) => {
    if ("section" in item) return path === "/" && section === item.section;
    return path === item.href || path.startsWith(`${item.href}/`);
  };
  const sub = inApp ? "app" : path.startsWith("/docs") ? "docs" : null;

  return (
    <header className="site-header" data-scrolled={scrolled || inApp ? "1" : "0"}>
      <div className="site-pill">
        <span className="site-glass" aria-hidden="true" />
        <Link href="/" className="relative z-10 flex shrink-0 items-baseline gap-2" aria-label={`${BRAND.name} home`}>
          <Wordmark id="wm-head" />
          {sub ? <span className="hidden font-mono text-[12px] text-fg-3 sm:inline">{sub}</span> : null}
        </Link>

        {inApp ? (
          <nav aria-label="App" className="relative z-10 hidden items-center gap-6 lg:flex">
            {APP_NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={path === item.href ? "page" : undefined} className="site-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
          <nav aria-label="Main" className="relative z-10 hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={current(item) ? "page" : undefined} className="site-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="relative z-10 flex min-w-0 shrink-0 items-center gap-2">
          {inApp ? (
            <span className="hidden h-[29px] items-center rounded-full border border-line px-3 font-mono text-[11px] text-fg-3 xl:inline-flex">
              {CHAIN.name}
            </span>
          ) : (
            <CopyCaTag />
          )}
          <div className="hidden sm:block">
            <NavWallet />
          </div>
          <div className="sm:hidden">
            <NavWallet compact />
          </div>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
            className="menu-btn grid size-9 shrink-0 place-items-center lg:hidden"
          >
            <span className="block">
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
      {menu ? <PhoneMenu inApp={inApp} onClose={() => setMenu(false)} /> : null}
    </header>
  );
}

function PhoneMenu({ onClose, inApp }: { onClose: () => void; inApp: boolean }) {
  const path = usePathname();
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
  const items: readonly { href: string; label: string }[] = inApp ? [...APP_NAV, { href: "/", label: "home" }] : NAV;
  // The header blurs what is behind it, which would trap a fixed child: portal to <body>.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[110] lg:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="enter absolute inset-x-3 top-3 rounded-[24px] border border-[#ffffff1f] bg-[#0b0b0d] p-5 shadow-[0_10px_40px_-12px_#000000b3]">
        <div className="flex items-center justify-between">
          <Wordmark id="wm-menu" />
          <button type="button" aria-label="Close menu" onClick={onClose} className="menu-btn grid size-9 place-items-center">
            <span className="block">
              <span style={{ transform: "translateY(3.75px) rotate(45deg)" }} />
              <span style={{ transform: "translateY(-3.75px) rotate(-45deg)" }} />
            </span>
          </button>
        </div>
        <nav aria-label="Phone" className="site-sheet mt-6 flex flex-col pl-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={path === item.href ? "page" : undefined}
              className="site-nav-link py-2.5 text-[18px]! leading-[26px]!"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <CopyCaTag />
          {inApp ? null : (
            <Link href="/app" onClick={onClose} className="site-launch">
              Launch app
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
