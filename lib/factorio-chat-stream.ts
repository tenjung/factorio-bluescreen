import { execFile } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const file = "factorio-server.log";
const folder = join(homedir(), "Library/Logs");
const listeners = new Set<(snapshot: string | null) => void>();
let watcher: FSWatcher | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;
let snapshot: string | undefined;
let reading = false;
let dirty = false;

async function refresh() {
  dirty = true;
  if (reading) return;
  reading = true;
  try {
    while (dirty && listeners.size) {
      dirty = false;
      const { stdout } = await run(
        "/usr/bin/tail",
        ["-n", "400", join(folder, file)],
        { timeout: 3000 },
      );
      const next = JSON.stringify(
        stdout
          .split("\n")
          .filter((line) =>
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[CHAT\] /.test(line),
          )
          .slice(-50),
      );
      if (listeners.size && next !== snapshot) {
        snapshot = next;
        for (const listen of listeners) listen(next);
      }
    }
  } catch {
    for (const listen of listeners) listen(null);
  } finally {
    reading = false;
  }
}

export const chatStreamHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
};

export function factorioChatStream(request: Request) {
  const encoder = new TextEncoder();
  let finish = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (text: string) => controller.enqueue(encoder.encode(text));
      const listen = (value: string | null) =>
        value === null ? finish() : emit(`data: ${value}\n\n`);
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
        if (!listeners.size) {
          watcher?.close();
          watcher = undefined;
          snapshot = undefined;
          clearTimeout(pending);
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
      listeners.add(listen);
      emit("retry: 3000\n\n");
      if (snapshot !== undefined) listen(snapshot);
      if (!watcher) {
        try {
          watcher = watch(folder, (_event, name) => {
            if (name && name !== file) return;
            clearTimeout(pending);
            pending = setTimeout(() => void refresh(), 120);
          });
          watcher.on("error", () => {
            for (const notify of listeners) notify(null);
          });
        } catch {
          finish();
          return;
        }
      }
      void refresh();
    },
    cancel() {
      finish();
    },
  });
  return new Response(body, { headers: chatStreamHeaders });
}
