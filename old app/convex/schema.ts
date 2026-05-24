import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  messages: defineTable({
    address: v.string(), // phone number
    body: v.string(),
    date: v.number(), // timestamp
    type: v.number(), // 1 = received, 2 = sent
    threadId: v.optional(v.string()),
    contactName: v.optional(v.string()),
    hasMedia: v.boolean(),
    mediaUrls: v.optional(v.array(v.string())),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"])
    .index("by_user_and_address", ["userId", "address"])
    .searchIndex("search_body", {
      searchField: "body",
      filterFields: ["userId", "address", "type"],
    }),

  calls: defineTable({
    number: v.string(),
    duration: v.number(), // in seconds
    date: v.number(), // timestamp
    type: v.number(), // 1 = incoming, 2 = outgoing, 3 = missed
    contactName: v.optional(v.string()),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"])
    .index("by_user_and_number", ["userId", "number"]),

  contacts: defineTable({
    phoneNumber: v.string(),
    name: v.string(),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_phone", ["userId", "phoneNumber"]),

  media: defineTable({
    messageId: v.id("messages"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_message", ["messageId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
