"use client";

import { useState } from "react";
import MessagesView from "./MessagesView";
import CallsView from "./CallsView";

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
      <header className="border-b bg-white px-4 py-3 flex items-center gap-6">
        <h1 className="font-semibold text-lg">Call &amp; Text Log</h1>
        <nav className="flex gap-1">
          <TabButton active={tab === "messages"} onClick={() => setTab("messages")}>
            Messages
            <span className="ml-2 text-xs text-neutral-500">
              {stats.messages.toLocaleString()}
            </span>
          </TabButton>
          <TabButton active={tab === "calls"} onClick={() => setTab("calls")}>
            Calls
            <span className="ml-2 text-xs text-neutral-500">
              {stats.calls.toLocaleString()}
            </span>
          </TabButton>
        </nav>
        <div className="ml-auto text-xs text-neutral-500">
          {stats.conversations.toLocaleString()} conversations ·{" "}
          {stats.attachments.toLocaleString()} attachments
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
      className={`px-3 py-1.5 rounded text-sm ${
        active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}
