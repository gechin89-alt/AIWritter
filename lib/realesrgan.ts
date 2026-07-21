import { spawn } from "node:child_process";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const EXE_PATH = path.join(process.cwd(), "tools", "realesrgan", "realesrgan-ncnn-vulkan.exe");
const WORKDIR = path.join(process.cwd(), "tools", "realesrgan");

/**
 * AI detail-restore pass (Real-ESRGAN, local binary, no API cost). Always
 * downscales to a fixed working size before upscaling 4x, so runtime stays
 * bounded regardless of the source photo's resolution — this works whether
 * the source is already sharp (acts as a clarity/detail boost) or small/
 * blurry (genuine restoration). Returns an absolute path to the result.
 */
export async function restoreDetail(inputAbsolutePath: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const workingInput = path.join(uploadsDir, `${randomUUID()}-esrgan-in.jpg`);
  const workingOutput = path.join(uploadsDir, `${randomUUID()}-esrgan-out.png`);

  await sharp(inputAbsolutePath)
    .resize({ width: 700, withoutEnlargement: false })
    .jpeg({ quality: 90 })
    .toFile(workingInput);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      EXE_PATH,
      ["-i", workingInput, "-o", workingOutput, "-n", "realesrgan-x4plus"],
      { cwd: WORKDIR },
    );
    proc.on("error", reject);
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`realesrgan exited ${code}`))));
  });

  const finalPath = path.join(uploadsDir, `${randomUUID()}-esrgan.jpg`);
  await sharp(workingOutput).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 92 }).toFile(finalPath);

  await Promise.allSettled([unlink(workingInput), unlink(workingOutput)]);

  return finalPath;
}
