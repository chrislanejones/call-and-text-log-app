import { useState } from "react";
import { MessageTab } from "./MessageTab";
import { CallTab } from "./CallTab";
import { MediaTab } from "./MediaTab";
import { ImportTab } from "./ImportTab";
import { SearchBar } from "./SearchBar";

type Tab = "messages" | "calls" | "media" | "import";

export function MessagingApp() {
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFilters, setSearchFilters] = useState<{
    address?: string;
    type?: number;
    number?: string;
  }>({});

  const tabs = [
    { id: "messages" as const, label: "Messages", icon: "💬" },
    { id: "calls" as const, label: "Calls", icon: "📞" },
    { id: "media" as const, label: "Photos", icon: "📷" },
    { id: "import" as const, label: "Import", icon: "📥" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      {activeTab !== "import" && (
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          activeTab={activeTab}
        />
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "messages" && (
          <MessageTab searchTerm={searchTerm} filters={searchFilters} />
        )}
        {activeTab === "calls" && (
          <CallTab searchTerm={searchTerm} filters={searchFilters} />
        )}
        {activeTab === "media" && <MediaTab />}
        {activeTab === "import" && <ImportTab />}
      </div>
    </div>
  );
}
