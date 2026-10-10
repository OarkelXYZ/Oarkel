import { BRAND } from "@/config/brand";
import { swapLive } from "@/config/contracts";

/** Site navigation, shared by the header and the phone menu. `section` marks in-page anchors on the home page. */
export const NAV = [
  { href: "/#how-it-works", label: "Protocol", section: "how-it-works" },
  { href: "/#get-oarkel", label: `Get ${BRAND.symbol}`, section: "get-oarkel" },
  { href: "/docs", label: "Docs" },
  { href: "/research", label: "Research" },
  { href: "/app", label: "App" },
  { href: "/#faq", label: "FAQ", section: "faq" },
] as const;

/** App navigation, used by the header while inside /app. The swap tab appears once the swap contract is set. */
export const APP_NAV: readonly { href: string; label: string }[] = [
  { href: "/app", label: "balances" },
  { href: "/app/shroud", label: "shroud" },
  { href: "/app/unshroud", label: "unshroud" },
  ...(swapLive() ? [{ href: "/app/swap", label: "swap" }] : []),
  { href: "/app/send", label: "send" },
  { href: "/app/activity", label: "history" },
  { href: "/app/settings", label: "settings" },
];
