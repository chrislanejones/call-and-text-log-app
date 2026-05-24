import { useState } from "react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filters: {
    address?: string;
    type?: number;
    number?: string;
  };
  onFiltersChange: (filters: any) => void;
  activeTab: "messages" | "calls" | "media";
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  filters,
  onFiltersChange,
  activeTab,
}: SearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white border-b p-4">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            showFilters
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          {activeTab === "messages" && (
            <>
              <input
                type="text"
                placeholder="Phone number"
                value={filters.address || ""}
                onChange={(e) =>
                  onFiltersChange({ ...filters, address: e.target.value || undefined })
                }
                className="px-3 py-1 text-sm border border-gray-300 rounded"
              />
              <select
                value={filters.type || ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    type: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="px-3 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="">All types</option>
                <option value="1">Received</option>
                <option value="2">Sent</option>
              </select>
            </>
          )}

          {activeTab === "calls" && (
            <>
              <input
                type="text"
                placeholder="Phone number"
                value={filters.number || ""}
                onChange={(e) =>
                  onFiltersChange({ ...filters, number: e.target.value || undefined })
                }
                className="px-3 py-1 text-sm border border-gray-300 rounded"
              />
              <select
                value={filters.type || ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    type: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="px-3 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="">All types</option>
                <option value="1">Incoming</option>
                <option value="2">Outgoing</option>
                <option value="3">Missed</option>
              </select>
            </>
          )}

          <button
            onClick={() => onFiltersChange({})}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
