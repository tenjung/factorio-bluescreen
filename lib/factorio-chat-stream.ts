import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const file = "factorio-server.log";
const folder = join(homedir(), "Library/Logs");
export const chatStreamHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
};

export function createFactorioLogStream(
  selectLines: (lines: string[]) => string[],
  load: (lines: string[]) => unknown | Promise<unknown>,
) {
  const listeners = new Set<(snapshot: string | null) => void>();
  const awaiting = new Set<(snapshot: string | null) => void>();
  let watcher: FSWatcher | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let snapshot: string | undefined;
  let reading = false;
  let dirty = false;

  let logRevision: string | undefined;
  let snapshotId = "";
  let cleanup: ReturnType<typeof setTimeout> | undefined;
  let force = false;

  async function refresh(forceRead = false) {
    dirty = true;
    force ||= forceRead;
    if (reading) return;
    reading = true;
    try {
      while (dirty && watcher) {
        dirty = false;
        const reread = force;
        force = false;
        const { stdout } = await run(
          "/usr/bin/tail",
          ["-n", "400", join(folder, file)],
          { timeout: 3000 },
        );
        const selected = selectLines(stdout.split("\n"));
        const revision = JSON.stringify(selected);
        if (!reread && revision === logRevision) continue;
        const next = JSON.stringify(await load(selected));
        if (!watcher) break;
        const changed = revision !== logRevision || snapshot === undefined;
        logRevision = revision;
        snapshot = next;
        if (changed) {
          snapshotId = createHash("sha256")
            .update(revision)
            .digest("base64url");
          for (const listen of listeners) listen(next);
        } else {
          for (const listen of awaiting) listen(next);
        }
        awaiting.clear();
      }
    } catch {
      for (const listen of listeners) listen(null);
    } finally {
      reading = false;
    }
  }

  return function stream(request: Request) {
    const lastId = request.headers.get("last-event-id");
    const encoder = new TextEncoder();
    let finish = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const emit = (text: string) => controller.enqueue(encoder.encode(text));
        const listen = (value: string | null) =>
          value === null
            ? finish()
            : emit(`id: ${snapshotId}\ndata: ${value}\n\n`);
        const pulse = setInterval(() => emit(": keepalive\n\n"), 12000);
        const expiration = setTimeout(() => finish(), 42000);
        let ended = false;
        finish = () => {
          if (ended) return;
          ended = true;
          clearInterval(pulse);
          clearTimeout(expiration);
          request.signal.removeEventListener("abort", finish);
          listeners.delete(listen);
          awaiting.delete(listen);
          if (!listeners.size) {
            cleanup = setTimeout(() => {
              watcher?.close();
              watcher = undefined;
              snapshot = undefined;
              logRevision = undefined;
              clearTimeout(pending);
              pending = undefined;
            }, 10000);
          }
          try {
            controller.close();
          } catch {
            /* Consumer disconnected. */
          }
        };
        if (request.signal.aborted) {
          finish();
          return;
        }
        request.signal.addEventListener("abort", finish, { once: true });
        clearTimeout(cleanup);
        listeners.add(listen);
        emit("retry: 3000\n\n");
        if (snapshot !== undefined && lastId && lastId !== snapshotId)
          listen(snapshot);
        if (!watcher) {
          try {
            watcher = watch(folder, (_event, name) => {
              if (name && name !== file) return;
              if (!pending)
                pending = setTimeout(() => {
                  pending = undefined;
                  void refresh();
                }, 250);
            });
            watcher.on("error", () => {
              for (const notify of listeners) notify(null);
            });
          } catch {
            finish();
            return;
          }
        }
        if (!lastId || snapshot === undefined) {
          awaiting.add(listen);
          void refresh(true);
        }
      },
      cancel() {
        finish();
      },
    });
    return new Response(body, { headers: chatStreamHeaders });
  };
}

export const factorioChatStream = createFactorioLogStream(
  (lines) =>
    lines
      .filter((line) =>
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[CHAT\] /.test(line),
      )
      .slice(-50),
  (lines) => lines,
);
