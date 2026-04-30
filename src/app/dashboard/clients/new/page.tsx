import Link from "next/link";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="entry">
        <Link
          href="/dashboard/clients"
          className="text-[12.5px] text-text-muted hover:text-text"
        >
          ← Clients
        </Link>
        <h1 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
          New client
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-muted">
          After saving, head into the client and run brand research so the
          pipeline can find good posts.
        </p>
      </div>
      <section className="entry delay-1 card max-w-3xl px-6 py-6">
        <ClientForm />
      </section>
    </div>
  );
}
