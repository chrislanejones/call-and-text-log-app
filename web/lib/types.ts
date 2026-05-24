export type Message = {
  rowid: number;
  kind: "sms" | "mms";
  address: string;
  address_normalized: string;
  conversation_key: string;
  contact_name: string;
  body: string;
  date: number;
  type: number | null;
  readable_date: string;
  has_images: number;
  attachments?: Attachment[];
};

export type Attachment = {
  hash: string;
  content_type: string;
  filename: string | null;
  size: number;
};

export type Call = {
  rowid: number;
  number: string;
  number_normalized: string;
  contact_name: string;
  duration: number | null;
  date: number;
  type: number | null;
  readable_date: string;
};

export type Conversation = {
  conversation_key: string;
  display_name: string;
  last_date: number;
  last_body: string;
  message_count: number;
};

export type MessageFilters = {
  q?: string;
  conversation?: string;
  contact?: string;
  number?: string;
  hasImages?: boolean;
  type?: number;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
};
