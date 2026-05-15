import "@tanstack/react-start/server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { db } from "@repo/db";
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
  },

  // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
  plugins: [tanstackStartCookies()],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
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
