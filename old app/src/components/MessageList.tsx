import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

interface MessageListProps {
  address: string;
  searchTerm: string;
  filters: {
    address?: string;
    type?: number;
  };
  onBack: () => void;
}

export function MessageList({ address, searchTerm, filters, onBack }: MessageListProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  
  const searchMessages = useQuery(
    api.messages.searchMessages,
    searchTerm ? {
      searchTerm,
      address,
      type: filters.type,
      paginationOpts: { numItems: 50, cursor },
    } : "skip"
  );

  const regularMessages = useQuery(
    api.messages.getMessages,
    !searchTerm ? {
      address,
      paginationOpts: { numItems: 50, cursor },
    } : "skip"
  );

  const messages = searchTerm ? searchMessages : regularMessages;

  if (!messages) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-blue-500 hover:text-blue-700"
        >
          ← Back
        </button>
        <h2 className="font-medium text-gray-900">{address}</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.page.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No messages found
          </div>
        ) : (
          <>
            {messages.page.map((message) => (
              <div
                key={message._id}
                className={`flex ${
                  message.type === 2 ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === 2
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-900"
                  }`}
                >
                  <p className="text-sm">{message.body}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(message.date).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            
            {!messages.isDone && (
              <div className="text-center">
                <button
                  onClick={() => setCursor(messages.continueCursor)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
