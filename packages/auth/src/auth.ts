import "@tanstack/react-start/server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { configDb as db } from "@repo/db/config";
import * as schema from "@repo/db/config-schema";
import { initializeDefaultTenant } from "@repo/db/services/tenant";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  baseURL: process.env.VITE_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  telemetry: {
    enabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "sqlite",
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
          // Promote to system admin if this is the first user registration or if no other system admin exists.
          try {
            const allUsers = await db.select().from(schema.user);

            const isFirstUser = allUsers.length <= 1 || allUsers.every((u) => u.id === user.id);
            const hasAnyAdmin = allUsers.some((u) => u.isSystemAdmin && u.id !== user.id);

            if (isFirstUser || !hasAnyAdmin) {
              await db
                .update(schema.user)
                .set({ isSystemAdmin: true })
                .where(eq(schema.user.id, user.id));
              console.log(`Promoted first user/sign-up (${user.email}) to system admin.`);

              // Link the newly promoted admin to the base tenant if it exists in the database
              try {
                const [baseTenant] = await db
                  .select()
                  .from(schema.tenant)
                  .where(eq(schema.tenant.isBase, true))
                  .limit(1);

                if (baseTenant) {
                  await db
                    .insert(schema.userTenant)
                    .values({
                      userId: user.id,
                      tenantId: baseTenant.tenantId,
                      role: "owner",
                    })
                    .onConflictDoNothing();
                  console.log(`Linked new system admin (${user.email}) to base tenant.`);
                }
              } catch (linkErr) {
                console.error("Failed to link new admin to base tenant:", linkErr);
              }
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
    // Better Auth's Drizzle adapter uses this for DB-backed session->user lookup.
    joins: true,
  },
});
