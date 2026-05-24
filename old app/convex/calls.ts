import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";

export const getCalls = query({
  args: { 
    paginationOpts: paginationOptsValidator,
    number: v.optional(v.string()),
    type: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let query = ctx.db
      .query("calls")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId));

    if (args.number) {
      query = ctx.db
        .query("calls")
        .withIndex("by_user_and_number", (q) => 
          q.eq("userId", userId).eq("number", args.number!)
        );
    }

    const result = await query.order("desc").paginate(args.paginationOpts);
    
    if (args.type !== undefined) {
      result.page = result.page.filter(call => call.type === args.type);
    }

    return result;
  },
});

export const importCalls = mutation({
  args: {
    calls: v.array(v.object({
      number: v.string(),
      duration: v.number(),
      date: v.number(),
      type: v.number(),
      contactName: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    for (const call of args.calls) {
      await ctx.db.insert("calls", {
        ...call,
        userId,
      });
    }

    return { imported: args.calls.length };
  },
});
