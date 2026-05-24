import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";

export const getMessages = query({
  args: { 
    paginationOpts: paginationOptsValidator,
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let query = ctx.db
      .query("messages")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId));

    if (args.address) {
      query = ctx.db
        .query("messages")
        .withIndex("by_user_and_address", (q) => 
          q.eq("userId", userId).eq("address", args.address!)
        );
    }

    return await query.order("desc").paginate(args.paginationOpts);
  },
});

export const searchMessages = query({
  args: {
    searchTerm: v.string(),
    address: v.optional(v.string()),
    type: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let searchQuery = ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) => {
        let query = q.search("body", args.searchTerm).eq("userId", userId);
        if (args.address) query = query.eq("address", args.address);
        if (args.type !== undefined) query = query.eq("type", args.type);
        return query;
      });

    return await searchQuery.paginate(args.paginationOpts);
  },
});

export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Group by address and get latest message for each conversation
    const conversations = new Map();
    
    for (const message of messages) {
      const existing = conversations.get(message.address);
      if (!existing || message.date > existing.date) {
        conversations.set(message.address, message);
      }
    }

    return Array.from(conversations.values())
      .sort((a, b) => b.date - a.date)
      .slice(0, 50);
  },
});

export const importMessages = mutation({
  args: {
    messages: v.array(v.object({
      address: v.string(),
      body: v.string(),
      date: v.number(),
      type: v.number(),
      threadId: v.optional(v.string()),
      contactName: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    for (const message of args.messages) {
      await ctx.db.insert("messages", {
        ...message,
        userId,
        hasMedia: false,
        mediaUrls: [],
      });
    }

    return { imported: args.messages.length };
  },
});
