"use client";

import { useState } from "react";
import MessagesView from "./MessagesView";
import CallsView from "./CallsView";
import ThemeToggle from "./ThemeToggle";

type Stats = {
  messages: number;
  calls: number;
  attachments: number;
  conversations: number;
};

export default function AppShell({ stats }: { stats: Stats }) {
  const [tab, setTab] = useState<"messages" | "calls">("messages");

  return (
    <main className="h-screen flex flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 flex items-center gap-6">
        <h1 className="font-semibold text-lg">Call &amp; Text Log</h1>
        <nav className="flex gap-1">
          <TabButton active={tab === "messages"} onClick={() => setTab("messages")}>
            Messages
            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
              {stats.messages.toLocaleString()}
            </span>
          </TabButton>
          <TabButton active={tab === "calls"} onClick={() => setTab("calls")}>
            Calls
            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
              {stats.calls.toLocaleString()}
            </span>
          </TabButton>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {stats.conversations.toLocaleString()} conversations ·{" "}
            {stats.attachments.toLocaleString()} attachments
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 min-h-0">
        {tab === "messages" ? <MessagesView /> : <CallsView />}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
