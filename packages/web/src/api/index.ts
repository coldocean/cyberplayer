import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { db } from "./database";
import * as schema from "./database/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAuth } from "./middleware/auth";
import { s3 } from "./lib/s3";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const app = new Hono()
  .use(
    cors({
      origin: (origin) => origin ?? "*",
      credentials: true,
      exposeHeaders: ["set-auth-token"],
    })
  )
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .use("*", authMiddleware)
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .get("/tracks", async (c) => {
    const allTracks = await db.select().from(schema.tracks);
    return c.json({ tracks: allTracks }, 200);
  })
  .post("/tracks/upload", requireAuth, async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const duration = formData.get("duration") as string | null;

    if (!file || !title) {
      return c.json({ message: "File and title are required" }, 400);
    }

    const key = `tracks/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "audio/mpeg",
      })
    );

    const [track] = await db
      .insert(schema.tracks)
      .values({
        title: title,
        filename: file.name,
        storageKey: key,
        duration: duration ? parseInt(duration) : null,
      })
      .returning();

    return c.json({ track }, 201);
  })
  .get("/tracks/:id/stream", async (c) => {
    const id = parseInt(c.req.param("id"));
    const [track] = await db
      .select()
      .from(schema.tracks)
      .where(eq(schema.tracks.id, id));

    if (!track) {
      return c.json({ message: "Track not found" }, 404);
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: track.storageKey,
      }),
      { expiresIn: 300 }
    );

    const response = await fetch(url);
    const body = response.body;

    if (!body) {
      return c.json({ message: "Failed to stream" }, 500);
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Accept-Ranges": "bytes",
      },
    });
  })
  .delete("/tracks/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const [track] = await db
      .select()
      .from(schema.tracks)
      .where(eq(schema.tracks.id, id));

    if (!track) {
      return c.json({ message: "Track not found" }, 404);
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: track.storageKey,
      })
    );

    await db.delete(schema.tracks).where(eq(schema.tracks.id, id));

    return c.json({ success: true }, 200);
  });

export type AppType = typeof app;
export default app;
