import { BRAND } from "@/config/brand";

/** Site navigation, shared by the header and the phone menu. `section` marks in-page anchors on the home page. */
export const NAV = [
  { href: "/#how-it-works", label: "Protocol", section: "how-it-works" },
  { href: "/#get-oarkel", label: `Get ${BRAND.symbol}`, section: "get-oarkel" },
  { href: "/docs", label: "Docs" },
  { href: "/research", label: "Research" },
  { href: "/app", label: "App" },
  { href: "/#faq", label: "FAQ", section: "faq" },
] as const;

/** App navigation, used by the header while inside /app. */
export const APP_NAV = [
  { href: "/app", label: "balances" },
  { href: "/app/shroud", label: "shroud" },
  { href: "/app/unshroud", label: "unshroud" },
  { href: "/app/send", label: "send" },
  { href: "/app/activity", label: "history" },
  { href: "/app/settings", label: "settings" },
] as const;
