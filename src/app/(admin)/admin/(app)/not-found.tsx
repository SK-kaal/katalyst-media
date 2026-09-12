import Link from "next/link";

export default function AdminNotFound() {
  return (
    <section className="admin-panel mx-auto max-w-xl p-8 text-center">
      <p className="admin-page-eyebrow">Not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-off-white">
        This portal record does not exist
      </h1>
      <p className="mt-3 text-sm leading-6 text-soft-grey">
        It may have been deleted, or the link may be incorrect.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/admin" className="admin-btn admin-btn--primary">
          Campaign Library
        </Link>
        <Link href="/admin/clients" className="admin-btn admin-btn--ghost">
          Clients
        </Link>
      </div>
    </section>
  );
}
