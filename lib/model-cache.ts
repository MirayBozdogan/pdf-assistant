import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Return exact file bytes rather than a pooled Node Buffer's backing ArrayBuffer.
// The latter can contain unrelated bytes and break JSON parsing under Next.js.
export function createModelCache(root: string, model: string) {
  const prefix = `https://huggingface.co/${model}/resolve/main/`;
  function location(key: string) {
    if (!key.startsWith(prefix)) return null;
    const relative = key.slice(prefix.length);
    if (!relative || relative.split("/").some((part) => !/^[\w.-]+$/.test(part) || part === "." || part === "..")) return null;
    return path.join(root, model, relative);
  }
  return {
    async match(key: string): Promise<Response | undefined> {
      const file = location(key);
      if (!file) return undefined;
      try {
        // Model assets are downloaded at runtime, not bundled into the server build.
        const bytes = await readFile(/* turbopackIgnore: true */ file);
        return new Response(new Uint8Array(bytes), { headers: { "Content-Length": String(bytes.length) } });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    async put(key: string, response: Response) {
      const file = location(key);
      if (!file) return;
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
      await rename(temporary, file);
    },
  };
}
