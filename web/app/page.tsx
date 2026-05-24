import fs from "node:fs";
import path from "node:path";
import AppShell from "./_components/AppShell";
import { getStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const dbPath = path.resolve(process.cwd(), "..", "data", "data.db");
  if (!fs.existsSync(dbPath)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold mb-4">No database yet</h1>
        <p className="mb-4 text-neutral-700 dark:text-neutral-300">
          Run the Rust parser first to generate <code>data/data.db</code>:
        </p>
        <pre className="bg-neutral-900 text-neutral-100 dark:bg-neutral-800 rounded p-4 text-sm overflow-x-auto">
{`cd parser
cargo run --release -- \\
  --calls ../calls-20251001192225.xml \\
  --sms   ../sms-20251001192225.xml`}
        </pre>
      </main>
    );
  }
  const stats = getStats();
  return <AppShell stats={stats} />;
}
