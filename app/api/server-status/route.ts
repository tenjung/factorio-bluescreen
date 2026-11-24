import { historyLimits, recentLimits } from "@/lib/factorio-list-limits";
import {
  chatStreamHeaders,
  createFactorioLogStream,
  factorioChatStream,
} from "@/lib/factorio-chat-stream";
import { factorioAddresses } from "@/lib/factorio-addresses";
import { factorioWorld } from "@/lib/factorio-world";
import { factorioSettings } from "@/lib/factorio-settings";
import {
  controlFactorio,
  preparedWorlds,
  switchWorld,
} from "@/lib/factorio-switch";
import { createHash, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { open, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";

const run = promisify(execFile);
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function historyResponse(
  request: Request,
  snapshot: { logs?: unknown; saves?: unknown; playerEvents?: unknown },
) {
  const history = new URL(request.url).searchParams.get("history");
  if (history !== "logs" && history !== "saves" && history !== "playerEvents")
    return null;
  return Response.json(
    { [history]: snapshot[history] ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function statusResponse(request: Request, body: unknown, revision: unknown) {
  const tag = `"${createHash("sha256").update(JSON.stringify(revision)).digest("base64url")}"`;
  const headers = { "Cache-Control": "no-store", ETag: tag };
  if (request.headers.get("if-none-match") === tag)
    return new Response(null, { status: 304, headers });
  return Response.json(body, { headers });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production")
    return new Response(null, { status: 405 });
  const bridge =
    process.env.VERCEL_ENV !== "preview" && process.env.FACTORIO_BRIDGE_SECRET;
  if (!bridge) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const scheme = process.env.VERCEL_ENV === "preview" ? "https" : "http";
    if (!host || origin !== `${scheme}://${host}`)
      return new Response(null, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }
  return handle(
    request,
    settingsView(new URL(request.url).searchParams.get("view")),
  );
}

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view");
  return handle(
    request,
    view === "switch-world" ||
      view === "world" ||
      view === "settings" ||
      view === "chat" ||
      view === "addresses"
      ? view
      : "status",
  );
}

function settingsView(view: string | null) {
  return view === "world" ||
    view === "switch-world" ||
    view === "control" ||
    view === "chat"
    ? view
    : "settings";
}

async function handle(
  request: Request,
  view:
    | "world"
    | "settings"
    | "status"
    | "switch-world"
    | "control"
    | "chat"
    | "addresses",
) {
  const settings = view !== "status";
  const stream =
    (view === "chat" || view === "status") &&
    request.method === "GET" &&
    new URL(request.url).searchParams.get("stream") === "1";
  const publicView = process.env.VERCEL_ENV === "production";
  if (publicView && settings && view !== "chat")
    return new Response(null, { status: 404 });
  const headers = { "Cache-Control": "no-store" };
  const secret = process.env.FACTORIO_BRIDGE_SECRET?.trim();
  if (settings && view !== "chat") {
    const password = process.env.FACTORIO_SETTINGS_PASSWORD?.trim();
    const supplied = Buffer.from(
      request.headers.get("x-settings-password") ?? "",
    );
    const expected = Buffer.from(password ?? "");
    if (
      !password ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return Response.json(
        { error: "settings_locked" },
        { status: 401, headers },
      );
    }
  }
  if (
    (process.env.VERCEL_ENV === "preview" || publicView) &&
    secret &&
    process.env.FACTORIO_BRIDGE_URL
  ) {
    try {
      const url = new URL(process.env.FACTORIO_BRIDGE_URL);
      if (settings) url.searchParams.set("view", view);
      if (stream) url.searchParams.set("stream", "1");
      const upstream = await fetch(url, {
        method: request.method,
        body: request.method === "POST" ? await request.text() : undefined,
        headers: {
          Authorization: `Bearer ${secret}`,
          ...(settings && !publicView
            ? {
                "x-settings-password":
                  request.headers.get("x-settings-password") ?? "",
              }
            : {}),
          ...(stream && request.headers.get("last-event-id")
            ? { "Last-Event-ID": request.headers.get("last-event-id")! }
            : {}),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: stream
          ? AbortSignal.any([request.signal, AbortSignal.timeout(50000)])
          : AbortSignal.timeout(
              view === "world" || view === "switch-world" || view === "control"
                ? 55000
                : settings
                  ? 12000
                  : 5000,
            ),
      });
      if (!upstream.ok) throw new Error("Bridge unavailable");
      if (stream) {
        if (
          !upstream.headers.get("content-type")?.startsWith("text/event-stream")
        )
          throw new Error("Expected chat stream");
        return new Response(upstream.body, { headers: chatStreamHeaders });
      }
      const status = await upstream.json();
      if (publicView && view === "status") {
        const snapshot = {
          running: status.running,
          uptime: status.uptime,
          cpu: status.cpu,
          memoryMiB: status.memoryMiB,
          checkedAt: status.checkedAt,
          players: status.players,
          playerEvents: status.playerEvents,
          world: status.world,
          saves: status.saves,
          logs: Array.isArray(status.logs)
            ? status.logs.map((line: string) =>
                line.replace(
                  /\/(?:Volumes|Users)\/[^\r\n]*\.zip/g,
                  (path) => path.split("/").at(-1) ?? "",
                ),
              )
            : null,
        };
        return (
          historyResponse(request, snapshot) ??
          statusResponse(request, snapshot, [
            snapshot.running,
            snapshot.players,
            snapshot.logs,
          ])
        );
      }
      if (view === "status")
        return (
          historyResponse(request, status) ??
          statusResponse(request, status, [
            status.running,
            status.players,
            status.logs,
          ])
        );
      if (view === "chat" && request.method === "GET")
        return statusResponse(request, status, status);
      return Response.json(status, { headers });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 503, headers });
    }
  }
  if (secret) {
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers });
    }
  }
  if (
    process.env.FACTORIO_LOCAL_STATUS !== "1" ||
    process.platform !== "darwin"
  ) {
    return Response.json({ error: "disabled" }, { status: 503, headers });
  }
  try {
    if (settings) {
      const root = process.env.FACTORIO_SERVER_DIR;
      if (!root) throw new Error("Missing dedicated server directory");
      if (view === "addresses")
        return Response.json(await factorioAddresses(), { headers });
      if (view === "chat") {
        if (stream) return factorioChatStream(request);
        if (request.method === "GET") {
          const { stdout } = await run(
            "/usr/bin/tail",
            ["-n", "400", join(homedir(), "Library/Logs/factorio-server.log")],
            { timeout: 3000 },
          );
          return Response.json(
            stdout
              .split("\n")
              .filter((line) =>
                /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[CHAT\] /.test(line),
              )
              .slice(-historyLimits.chat),
            { headers },
          );
        }
        const { message } = await request.json();
        if (
          typeof message !== "string" ||
          !message.trim() ||
          message.length > 200 ||
          [...message].some(
            (character) =>
              character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ) ||
          message.trimStart().startsWith("/")
        ) {
          return Response.json(
            { error: "invalid_chat" },
            { status: 400, headers },
          );
        }
        await run(join(root, "rcon.sh"), [`[웹 관리자] ${message.trim()}`], {
          timeout: 2500,
        });
        return Response.json({ sent: true }, { headers });
      }
      if (view === "control") {
        const { action, confirmed } = await request.json();
        if (confirmed !== true && (action === "stop" || action === "restart")) {
          return Response.json(
            { error: "confirmation_required" },
            { status: 400, headers },
          );
        }
        return Response.json(await controlFactorio(root, action), { headers });
      }
      if (view === "switch-world") {
        if (request.method === "GET")
          return Response.json(await preparedWorlds(root), { headers });
        const input = await request.json();
        if (input.confirmDisconnect !== true)
          return Response.json(
            { error: "confirmation_required" },
            { status: 400, headers },
          );
        return Response.json(await switchWorld(root, input.name, true), {
          headers,
        });
      }
      return Response.json(
        await (view === "world"
          ? factorioWorld(root, request)
          : factorioSettings(root, request)),
        { headers },
      );
    }
    if (stream) return factorioStatusStream(request);
    const snapshot = await readFactorioStatus();
    return (
      historyResponse(request, snapshot) ??
      statusResponse(request, snapshot, [
        snapshot.running,
        snapshot.players,
        snapshot.logs,
      ])
    );
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers });
  }
}

async function loadedWorld(root: string) {
  try {
    const file = await open(join(root, "data/factorio-current.log"), "r");
    try {
      const buffer = Buffer.alloc(128 * 1024);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      const match = /Loading map (.+?\.zip): \d+ bytes\./.exec(
        buffer.toString("utf8", 0, bytesRead),
      );
      return match ? basename(match[1]) : null;
    } finally {
      await file.close();
    }
  } catch {
    return null;
  }
}

async function readFactorioStatus() {
  const { stdout } = await run(
    "/bin/ps",
    ["-ww", "-axo", "pid=,etime=,%cpu=,rss=,args="],
    { timeout: 3000 },
  );
  const processes = stdout
    .split("\n")
    .filter(
      (line) =>
        /^\s*\d+\s+\S+\s+[\d.]+\s+\d+\s+.*\/Contents\/MacOS\/factorio\s+/.test(
          line,
        ) && /\s--start-server(?:-load-latest)?(?:\s|$)/.test(line),
    );
  if (processes.length > 1) throw new Error("Multiple dedicated servers");
  const row = processes[0]?.trim().split(/\s+/, 5);
  const root = process.env.FACTORIO_SERVER_DIR;
  if (!root) throw new Error("Missing dedicated server directory");
  const [playerOutput, logOutput, entries, worldResult] =
    await Promise.allSettled([
      row
        ? run(join(root, "rcon.sh"), ["/players online"], { timeout: 3000 })
        : Promise.resolve(null),
      run(
        "/usr/bin/tail",
        ["-n", "5000", join(homedir(), "Library/Logs/factorio-server.log")],
        { timeout: 3000 },
      ),
      readdir(join(root, "data/saves"), { withFileTypes: true }),
      row ? loadedWorld(root) : Promise.resolve(null),
    ]);
  const playerText =
    playerOutput.status === "fulfilled"
      ? playerOutput.value?.stdout
      : undefined;
  const players = !row
    ? []
    : playerText?.includes("Online players (")
      ? Array.from(
          playerText.matchAll(/^ +(.+) \(online\)$/gm),
          ([, name]) => name,
        )
      : null;
  const playerEvents =
    logOutput.status === "fulfilled"
      ? logOutput.value.stdout
          .split("\n")
          .flatMap((line) => {
            const event =
              /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(JOIN|LEAVE)\] (.+?) (?:joined|left) the game\s*$/.exec(
                line,
              );
            return event
              ? [{ at: event[1], action: event[2], player: event[3] }]
              : [];
          })
          .slice(-historyLimits.playerEvents)
          .reverse()
      : null;
  const logs =
    logOutput.status === "fulfilled"
      ? logOutput.value.stdout
          .split("\n")
          .filter(
            (line) =>
              /\[(JOIN|LEAVE)\]|Saving (to |finished)|Hosting game|Changing state/.test(
                line,
              ) &&
              !/\[CHAT\]|https?:|password|token|(?:\d{1,3}\.){3}\d{1,3}/i.test(
                line,
              ),
          )
          .slice(-historyLimits.logs)
      : null;
  const saves =
    entries.status === "fulfilled"
      ? await Promise.all(
          entries.value
            .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
            .map(async ({ name }) => {
              const file = await stat(join(root, "data/saves", name));
              return {
                name,
                size: file.size,
                modified: file.mtime.toISOString(),
              };
            }),
        ).catch(() => null)
      : null;
  saves?.sort((a, b) => b.modified.localeCompare(a.modified));
  const snapshot = {
    players,
    playerEvents,
    world: worldResult.status === "fulfilled" ? worldResult.value : null,
    logs,
    saves: saves?.slice(0, historyLimits.saves) ?? null,
    running: Boolean(row),
    uptime: row?.[1] ?? null,
    cpu: row ? Number(row[2]) : null,
    memoryMiB: row ? Math.round(Number(row[3]) / 1024) : null,
    checkedAt: new Date().toISOString(),
  };
  return snapshot;
}

const factorioStatusStream = createFactorioLogStream(
  (lines) =>
    lines
      .filter(
        (line) =>
          !line.includes("[CHAT]") &&
          /\[(JOIN|LEAVE)\]|Saving (to |finished)|Hosting game|changing state|Starting RCON interface|Goodbye/i.test(
            line,
          ),
      )
      .slice(-50),
  async () => {
    const snapshot = await readFactorioStatus();
    return {
      ...snapshot,
      playerEvents:
        snapshot.playerEvents?.slice(0, recentLimits.playerEvents) ?? null,
      saves: snapshot.saves?.slice(0, recentLimits.saves) ?? null,
      logs:
        snapshot.logs
          ?.slice(-recentLimits.logs)
          .map((line) =>
            line.replace(
              /\/(?:Volumes|Users)\/[^\r\n]*\.zip/g,
              (path) => path.split("/").at(-1) ?? "",
            ),
          ) ?? null,
    };
  },
);
