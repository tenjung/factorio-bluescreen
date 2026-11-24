import { factorioWorld } from "@/lib/factorio-world";
import { factorioSettings } from "@/lib/factorio-settings";
import {
  controlFactorio,
  preparedWorlds,
  switchWorld,
} from "@/lib/factorio-switch";
import { timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";

const run = promisify(execFile);
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
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
      view === "chat"
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
  view: "world" | "settings" | "status" | "switch-world" | "control" | "chat",
) {
  const settings = view !== "status";
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
    process.env.VERCEL_ENV === "preview" &&
    secret &&
    process.env.FACTORIO_BRIDGE_URL
  ) {
    try {
      const url = new URL(process.env.FACTORIO_BRIDGE_URL);
      if (settings) url.searchParams.set("view", view);
      const upstream = await fetch(url, {
        method: request.method,
        body: request.method === "POST" ? await request.text() : undefined,
        headers: {
          Authorization: `Bearer ${secret}`,
          ...(settings
            ? {
                "x-settings-password":
                  request.headers.get("x-settings-password") ?? "",
              }
            : {}),
          "Content-Type": "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(
          view === "world" || view === "switch-world" || view === "control"
            ? 55000
            : settings
              ? 12000
              : 5000,
        ),
      });
      if (!upstream.ok) throw new Error("Bridge unavailable");
      return Response.json(await upstream.json(), { headers });
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
      if (view === "chat") {
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
              .slice(-50),
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
    const [playerOutput, logOutput, entries] = await Promise.allSettled([
      row
        ? run(join(root, "rcon.sh"), ["/players online"], { timeout: 3000 })
        : Promise.resolve(null),
      run(
        "/usr/bin/tail",
        ["-n", "300", join(homedir(), "Library/Logs/factorio-server.log")],
        { timeout: 3000 },
      ),
      readdir(join(root, "data/saves"), { withFileTypes: true }),
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
            .slice(-50)
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
    return Response.json(
      {
        players,
        logs,
        saves,
        running: Boolean(row),
        uptime: row?.[1] ?? null,
        cpu: row ? Number(row[2]) : null,
        memoryMiB: row ? Math.round(Number(row[3]) / 1024) : null,
        checkedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers });
  }
}
