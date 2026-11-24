import { createServer, type IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { GET, POST } from "../app/api/server-status/route";

const address = "127.0.0.1";
const port = Number(process.env.FACTORIO_AGENT_PORT ?? 3111);
const maxBodyBytes = 128 * 1024;

if (
  process.platform !== "darwin" ||
  process.env.FACTORIO_LOCAL_STATUS !== "1" ||
  !process.env.FACTORIO_SERVER_DIR ||
  !process.env.FACTORIO_BRIDGE_SECRET?.trim() ||
  !process.env.FACTORIO_SETTINGS_PASSWORD?.trim() ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  process.env.VERCEL_ENV
)
  throw new Error("Invalid local Factorio agent configuration");

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maxBodyBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (incoming, outgoing) => {
  const disconnect = new AbortController();
  outgoing.once("close", () => disconnect.abort());
  try {
    const url = new URL(incoming.url ?? "/", `http://${address}:${port}`);
    if (url.pathname !== "/api/server-status") {
      outgoing.writeHead(404).end();
      return;
    }
    const method = incoming.method;
    if (method !== "GET" && method !== "POST") {
      outgoing.writeHead(405, { Allow: "GET, POST" }).end();
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value))
        value.forEach((item) => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    const body = method === "POST" ? await readBody(incoming) : undefined;
    if (body === null) {
      if (!outgoing.destroyed)
        outgoing.writeHead(413, { Connection: "close" }).end();
      return;
    }
    const request = new Request(url, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: disconnect.signal,
    });
    const response = await (method === "GET" ? GET(request) : POST(request));
    if (outgoing.destroyed) {
      await response.body?.cancel();
      return;
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.flushHeaders();
    if (response.body)
      await pipeline(
        Readable.fromWeb(response.body as NodeReadableStream),
        outgoing,
        { signal: disconnect.signal },
      );
    else outgoing.end();
  } catch {
    if (outgoing.destroyed || disconnect.signal.aborted) return;
    if (!outgoing.headersSent)
      outgoing.writeHead(500, { "Cache-Control": "no-store" });
    outgoing.end();
  }
});

server.listen(port, address, () =>
  console.log(`Factorio API listening on ${address}:${port}`),
);
