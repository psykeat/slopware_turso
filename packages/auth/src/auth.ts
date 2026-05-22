import "@tanstack/react-start/server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { db, eq } from "@repo/db";
import * as schema from "@repo/db/schema";
import { initializeDefaultTenant } from "@repo/db/services/tenant";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  baseURL: process.env.VITE_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  telemetry: {
    enabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  user: {
    additionalFields: {
      isSystemAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
    changeEmail: {
      enabled: true,
    },
  },

  // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
  plugins: [tanstackStartCookies()],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Promote to system admin if no other real system admin exists.
          // This ensures the first person to sign up via the auth flow always gets
          // admin access, even when a seed placeholder (id="admin-id") is present.
          try {
            const existingAdmins = await db
              .select()
              .from(schema.user)
              .where(eq(schema.user.isSystemAdmin, true));

            const hasRealAdmin = existingAdmins.some((u) => u.id !== user.id);
            if (!hasRealAdmin) {
              await db
                .update(schema.user)
                .set({ isSystemAdmin: true })
                .where(eq(schema.user.id, user.id));
              console.log(`Promoted first sign-up (${user.email}) to system admin.`);
            }
          } catch (e) {
            console.error("Failed to check or promote first user to system admin:", e);
          }

          await initializeDefaultTenant(user.id, user.name);
        },
      },
    },
  },

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    enabled: true,
  },

  experimental: {
    // https://www.better-auth.com/docs/adapters/drizzle#joins-experimental
    joins: true,
  },
});
