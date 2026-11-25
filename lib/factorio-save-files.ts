import { constants } from "node:fs";
import { lstat, open, readdir, statfs, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { loadedWorld } from "./factorio-loaded-world";
import { reserveFactorioOperation, switchWorld } from "./factorio-switch";

const headers = { "Cache-Control": "no-store" };
const valid = (name: unknown): name is string =>
  typeof name === "string" &&
  name.length <= 255 &&
  name.endsWith(".zip") &&
  !name.includes("/") &&
  !name.includes("\\") &&
  ![...name].some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );

async function saveFiles(root: string) {
  const directory = join(root, "data/saves");
  const [entries, active] = await Promise.all([
    readdir(directory, { withFileTypes: true }),
    loadedWorld(root),
  ]);
  const files = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && valid(entry.name))
        .map(async ({ name }) => {
          const info = await lstat(join(directory, name)).catch((error) => {
            if (error.code === "ENOENT") return null;
            throw error;
          });
          return info?.isFile()
            ? {
                name,
                size: info.size,
                modified: info.mtime.toISOString(),
                mtime: info.mtimeMs,
              }
            : null;
        }),
    )
  )
    .filter((file) => file !== null)
    .sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));

  return files.map(({ name, size, modified, mtime }) => ({
    name,
    size,
    modified,
    protected:
      name === active ||
      name === "world.zip" ||
      mtime === files[0].mtime ||
      !active,
  }));
}

async function saveInventory(root: string) {
  const [files, disk] = await Promise.all([
    saveFiles(root),
    statfs(join(root, "data/saves")).catch(() => null),
  ]);
  return { files, availableBytes: disk ? disk.bavail * disk.bsize : null };
}

export async function factorioSaveFiles(root: string, request: Request) {
  const directory = join(root, "data/saves");
  if (request.method === "GET") {
    const query = new URL(request.url).searchParams;
    const name = query.get("file");
    if (name === null)
      return Response.json(
        await (query.get("inventory") === "1"
          ? saveInventory(root)
          : saveFiles(root)),
        { headers },
      );
    if (!valid(name))
      return Response.json(
        { error: "invalid_filename" },
        { status: 400, headers },
      );
    const file = await open(
      join(directory, name),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    ).catch((error) => {
      if (error.code === "ENOENT" || error.code === "ELOOP") return null;
      throw error;
    });
    if (!file)
      return Response.json({ error: "not_found" }, { status: 404, headers });
    let streamOpened = false;
    try {
      if (!(await file.stat()).isFile())
        return Response.json({ error: "not_found" }, { status: 404, headers });
      const encoded = encodeURIComponent(name).replace(
        /['()*]/g,
        (char) => "%" + char.charCodeAt(0).toString(16),
      );
      const stream = Readable.toWeb(
        file.createReadStream({ signal: request.signal }),
      );
      const response = new Response(stream as ReadableStream<Uint8Array>, {
        headers: {
          ...headers,
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
        },
      });
      streamOpened = true;
      return response;
    } finally {
      if (!streamOpened) await file.close();
    }
  }

  const input = await request.json();
  if (input?.confirmRollback === true && valid(input.name)) {
    const name = `world-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    const result = await switchWorld(
      root,
      name,
      true,
      join(directory, input.name),
    );
    return Response.json(result, { headers });
  }
  if (
    input?.confirmPermanentDeletion !== true ||
    !Array.isArray(input.names) ||
    !input.names.length ||
    input.names.length > 1000 ||
    !input.names.every(valid)
  ) {
    return Response.json(
      { error: "invalid_selection" },
      { status: 400, headers },
    );
  }
  const release = reserveFactorioOperation();
  if (!release)
    return Response.json(
      { error: "operation_running" },
      { status: 409, headers },
    );
  try {
    const names = [...new Set<string>(input.names)];
    const files = new Map(
      (await saveFiles(root)).map((file) => [file.name, file]),
    );
    if (names.some((name) => files.get(name)?.protected !== false)) {
      return Response.json(
        { error: "protected_or_missing" },
        { status: 409, headers },
      );
    }
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const name of names) {
      try {
        await unlink(join(directory, name));
        deleted.push(name);
      } catch {
        failed.push(name);
      }
    }
    return Response.json(
      { deleted, failed, ...(await saveInventory(root)) },
      { headers },
    );
  } finally {
    release();
  }
}
