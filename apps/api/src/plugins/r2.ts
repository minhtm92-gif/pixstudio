/**
 * Cloudflare R2 plugin — S3-compatible client decorated on Fastify instance.
 * Uses @aws-sdk/client-s3 with R2 endpoint URL + per-bucket scoped token.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { S3Client } from "@aws-sdk/client-s3";
import { apiEnv } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    r2: S3Client;
    r2Buckets: { uploads: string; renders: string; derived: string };
  }
}

const r2Impl: FastifyPluginAsync = async (app: FastifyInstance) => {
  if (!apiEnv.R2_ENDPOINT_URL || !apiEnv.R2_ACCESS_KEY_ID || !apiEnv.R2_SECRET_ACCESS_KEY) {
    app.log.warn("R2 env not set — uploads disabled");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: apiEnv.R2_ENDPOINT_URL,
    credentials: {
      accessKeyId: apiEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: apiEnv.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  app.decorate("r2", client);
  app.decorate("r2Buckets", {
    uploads: apiEnv.R2_BUCKET_UPLOADS,
    renders: apiEnv.R2_BUCKET_RENDERS,
    derived: apiEnv.R2_BUCKET_DERIVED,
  });

  app.log.info(`R2 client ready: endpoint=${apiEnv.R2_ENDPOINT_URL}`);

  app.addHook("onClose", async () => {
    client.destroy();
  });
};

export default fp(r2Impl, { name: "r2" });
