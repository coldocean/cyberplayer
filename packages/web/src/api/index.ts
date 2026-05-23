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

// ── SONG IDENTIFICATION (ACRCloud) ──────────────────────────────────────────
// Requires ACR_HOST, ACR_ACCESS_KEY, ACR_ACCESS_SECRET env vars
// Falls back gracefully if not configured
app.post("/identify-song", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { audio_base64, mime } = body as { audio_base64?: string; mime?: string };

  if (!audio_base64) return c.json({ message: "No audio provided" }, 400);

  const acrHost = process.env.ACR_HOST;
  const acrKey = process.env.ACR_ACCESS_KEY;
  const acrSecret = process.env.ACR_ACCESS_SECRET;

  if (!acrHost || !acrKey || !acrSecret) {
    return c.json({ message: "Song ID service not configured" }, 503);
  }

  try {
    // ACRCloud HTTP API v1
    const crypto = await import("crypto");
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${acrKey}\naudio\n1\n${timestamp}`;
    const signature = crypto
      .createHmac("sha1", acrSecret)
      .update(stringToSign)
      .digest("base64");

    const audioBuffer = Buffer.from(audio_base64, "base64");

    const fd = new FormData();
    fd.append("sample", new Blob([audioBuffer], { type: mime || "audio/webm" }), "sample.webm");
    fd.append("access_key", acrKey);
    fd.append("data_type", "audio");
    fd.append("signature_version", "1");
    fd.append("signature", signature);
    fd.append("sample_bytes", String(audioBuffer.length));
    fd.append("timestamp", String(timestamp));

    const resp = await fetch(`https://${acrHost}/v1/identify`, {
      method: "POST",
      body: fd,
    });
    const data = await resp.json() as any;

    if (data.status?.code === 0 && data.metadata?.music?.[0]) {
      const m = data.metadata.music[0];
      return c.json({
        title: m.title,
        artist: m.artists?.map((a: any) => a.name).join(", ") || "",
        album: m.album?.name || "",
        score: m.score,
      });
    }
    return c.json({ message: data.status?.msg || "Not recognized" });
  } catch (e: any) {
    return c.json({ message: "Error: " + e.message }, 500);
  }
});

export type AppType = typeof app;
export default app;
