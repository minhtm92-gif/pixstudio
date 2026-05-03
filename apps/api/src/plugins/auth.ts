/**
 * Better-auth plugin — email/password + magic link.
 * Per D22 internal+đối tác only Phase 0-3, no SSO Google/Apple v0.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@prisma/client";
import { apiEnv, authSecret } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    auth: ReturnType<typeof betterAuth>;
  }
}

const authImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  const prisma = app.prisma as PrismaClient | undefined;
  if (!prisma) {
    app.log.warn("Prisma not registered before auth — auth disabled");
    return;
  }

  if (!authSecret) {
    app.log.warn("NEXTAUTH_SECRET / BETTER_AUTH_SECRET not set — auth disabled");
    return;
  }

  // trustedOrigins: better-auth has its own origin allowlist (separate from
  // Fastify CORS). Without this, signup/login from studio.pixelxlab.com hits
  // 403 INVALID_ORIGIN. Vercel preview branches auto-allowed via regex.
  const TRUSTED_ORIGINS = [
    "https://studio.pixelxlab.com",
    "https://pixstudio.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    /^https:\/\/pixstudio[a-z0-9-]*\.vercel\.app$/,
  ];

  const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: authSecret,
    baseURL: apiEnv.AUTH_BASE_URL ?? `http://${apiEnv.HOST}:${apiEnv.PORT}`,
    trustedOrigins: TRUSTED_ORIGINS as never,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Phase 0 internal — Phase 3+ enable
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh token after 1 day active
    },
    advanced: {
      cookiePrefix: "pxs",
      useSecureCookies: apiEnv.NODE_ENV === "production",
    },
  });

  // better-auth types vs fastify decorate generic type narrows imperfectly
  // (BetterAuthOptions vs concrete config). Safe to cast — runtime use is correct.
  app.decorate("auth", auth as unknown as ReturnType<typeof betterAuth>);

  // Mount better-auth handler at /api/auth/*
  app.all("/api/auth/*", async (req, reply) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) headers.set(key, value.join(", "));
      else if (value !== undefined) headers.set(key, String(value));
    }
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const response = await auth.handler(request);
    reply.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      reply.header(key, value);
    }
    return response.body ? await response.text() : null;
  });

  app.log.info("Better-auth ready: email/pw + 30d sessions at /api/auth/*");
};

export default fp(authImpl, { name: "auth", dependencies: ["prisma"] });
