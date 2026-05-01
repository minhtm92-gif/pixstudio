/**
 * Cloudflare R2 plugin — S3-compatible client decorated on Fastify instance.
 * Uses @aws-sdk/client-s3 with R2 endpoint URL + per-bucket scoped token.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { S3Client } from "@aws-sdk/client-s3";

declare module "fastify" {
  interface FastifyInstance {
    r2: S3Client;
    r2Buckets: { uploads: string; renders: string; derived: string };
  }
}

const r2Impl: FastifyPluginAsync = async (app: FastifyInstance) => {
  const endpoint = process.env.R2_ENDPOINT_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    app.log.warn("R2 env not set — uploads disabled");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  app.decorate("r2", client);
  app.decorate("r2Buckets", {
    uploads: process.env.R2_BUCKET_UPLOADS ?? "pxs-vn-sg-uploads",
    renders: process.env.R2_BUCKET_RENDERS ?? "pxs-vn-sg-renders",
    derived: process.env.R2_BUCKET_DERIVED ?? "pxs-vn-sg-derived",
  });

  app.log.info(`R2 client ready: endpoint=${endpoint}`);

  app.addHook("onClose", async () => {
    client.destroy();
  });
};

export default fp(r2Impl, { name: "r2" });
