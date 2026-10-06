import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main id="main" className="wrap-narrow pt-[160px] pb-28">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-mono text-[30px] leading-tight font-medium tracking-[-0.025em] md:text-[36px]">This page is not on the record</h1>
      <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-fg-2">
        The link may be old or mistyped. The home page, the docs and the app are all one click away.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn-ink inline-flex h-11 items-center rounded-full px-5 font-mono text-[14px]">Home</Link>
        <Link href="/docs" className="btn-ghost inline-flex h-11 items-center rounded-full px-5 font-mono text-[14px]">Docs</Link>
      </div>
    </main>
  );
}
