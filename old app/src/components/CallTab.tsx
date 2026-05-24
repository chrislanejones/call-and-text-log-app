import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

interface CallTabProps {
  searchTerm: string;
  filters: {
    number?: string;
    type?: number;
  };
}

export function CallTab({ searchTerm, filters }: CallTabProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  
  const calls = useQuery(api.calls.getCalls, {
    number: filters.number,
    type: filters.type,
    paginationOpts: { numItems: 50, cursor },
  });

  if (!calls) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const filteredCalls = calls.page.filter((call) => {
    if (searchTerm && !call.number.includes(searchTerm) && 
        !call.contactName?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getCallTypeIcon = (type: number) => {
    switch (type) {
      case 1: return "📞"; // Incoming
      case 2: return "📱"; // Outgoing
      case 3: return "📵"; // Missed
      default: return "📞";
    }
  };

  const getCallTypeLabel = (type: number) => {
    switch (type) {
      case 1: return "Incoming";
      case 2: return "Outgoing";
      case 3: return "Missed";
      default: return "Unknown";
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="h-full overflow-y-auto">
      {filteredCalls.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No calls found
        </div>
      ) : (
        <div className="divide-y">
          {filteredCalls.map((call) => (
            <div key={call._id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCallTypeIcon(call.type)}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {call.contactName || call.number}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{getCallTypeLabel(call.type)}</span>
                      <span>•</span>
                      <span>{formatDuration(call.duration)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(call.date).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          
          {!calls.isDone && (
            <div className="text-center p-4">
              <button
                onClick={() => setCursor(calls.continueCursor)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
