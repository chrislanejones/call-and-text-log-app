import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ConversationListProps {
  searchTerm: string;
  filters: {
    address?: string;
    type?: number;
  };
  onSelectConversation: (address: string) => void;
}

export function ConversationList({
  searchTerm,
  filters,
  onSelectConversation,
}: ConversationListProps) {
  const conversations = useQuery(api.messages.getConversations);

  if (!conversations) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const filteredConversations = conversations.filter((conv) => {
    if (filters.address && !conv.address.includes(filters.address)) return false;
    if (searchTerm && !conv.body.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto">
      {filteredConversations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No conversations found
        </div>
      ) : (
        <div className="divide-y">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation._id}
              onClick={() => onSelectConversation(conversation.address)}
              className="p-4 hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">
                      {conversation.contactName || conversation.address}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        conversation.type === 1
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {conversation.type === 1 ? "Received" : "Sent"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {conversation.body}
                  </p>
                </div>
                <div className="text-xs text-gray-500 ml-4">
                  {new Date(conversation.date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
