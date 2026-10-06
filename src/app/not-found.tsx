import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main id="main" className="wrap py-28">
      <p className="label text-surge">404</p>
      <h1 className="display mt-3 text-[44px] leading-tight">This page is not on the record</h1>
      <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-fg-2">
        The link may be old or mistyped. The home page, the docs and the app are all one click away.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn-ink inline-flex h-11 items-center rounded-full px-5 font-semibold">Home</Link>
        <Link href="/docs" className="btn-ghost inline-flex h-11 items-center rounded-full px-5 font-semibold">Docs</Link>
      </div>
    </main>
  );
}
