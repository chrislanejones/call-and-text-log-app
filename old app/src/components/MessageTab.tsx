import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";

interface MessageTabProps {
  searchTerm: string;
  filters: {
    address?: string;
    type?: number;
  };
}

export function MessageTab({ searchTerm, filters }: MessageTabProps) {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  if (selectedAddress) {
    return (
      <MessageList
        address={selectedAddress}
        searchTerm={searchTerm}
        filters={filters}
        onBack={() => setSelectedAddress(null)}
      />
    );
  }

  return (
    <ConversationList
      searchTerm={searchTerm}
      filters={filters}
      onSelectConversation={setSelectedAddress}
    />
  );
}
