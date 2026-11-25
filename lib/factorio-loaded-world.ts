import { open } from "node:fs/promises";
import { basename, join } from "node:path";

export async function loadedWorld(root: string) {
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
