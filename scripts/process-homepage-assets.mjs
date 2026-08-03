import sharp from "sharp";
import path from "node:path";
import { rename, unlink, copyFile } from "node:fs/promises";

const SRC =
  "C:/Users/Administrator/AppData/Roaming/Cursor/User/workspaceStorage/a234245b24d41df0d76d6947f9aa18ab/images";
const OUT = "public/images";

async function safeWrite(pipeline, output) {
  const tmp = `${output}.tmp`;
  try {
    await unlink(tmp);
  } catch {
    // ignore
  }
  await pipeline.toFile(tmp);
  try {
    await unlink(output);
  } catch {
    // ignore
  }
  await rename(tmp, output);
  console.log("wrote", output);
}

async function removeNearBlack(input, output, threshold = 20) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) {
      data[i + 3] = 0;
      continue;
    }
    const max = Math.max(r, g, b);
    if (max <= threshold) {
      data[i + 3] = 0;
      continue;
    }
    if (max <= threshold + 18 && a < 200) {
      data[i + 3] = Math.max(0, Math.round(a * ((max - threshold) / 18)));
    }
  }

  await safeWrite(
    sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png(),
    output,
  );
}

async function writeCover(input, output, width, height) {
  await safeWrite(
    sharp(input).resize(width, height, { fit: "cover", position: "centre" }).png({ quality: 92 }),
    output,
  );
}

// Hero cutout — African male, arms crossed
await removeNearBlack(
  path.join(SRC, "image-00753fa5-dcb1-4149-b76d-f69ab1bc237e.png"),
  path.join(OUT, "homepage-hero-pro.png"),
);

// Featured pro — African female electrician (remove black studio bg)
await removeNearBlack(
  path.join(SRC, "image-8bc3137d-a5d1-45ab-bbc2-d0beabcd118c.png"),
  path.join(OUT, "featured-amina.png"),
  18,
);

// Phone — African hand + Amina booking UI (use source as-is)
await safeWrite(
  sharp(path.join(SRC, "image-22b35dfb-c517-4f6a-8eb3-e98c18346028.png")).png(),
  path.join(OUT, "booking-phone-amina.png"),
);

// Lifestyle
await writeCover(
  path.join(SRC, "image-cc7ef4ee-4c87-4af3-bc1a-cfe101166871.png"),
  path.join(OUT, "trusted-homes.png"),
  1200,
  900,
);

// Category cards — African professionals
await writeCover(path.join(SRC, "image-b19fe080-05cd-4483-9e84-4879bcea63bc.png"), path.join(OUT, "cat-plumbing.png"), 640, 800);
await writeCover(path.join(SRC, "image-41225c3c-397c-4477-b4d7-6663678cea11.png"), path.join(OUT, "cat-electrical.png"), 640, 800);
await writeCover(path.join(SRC, "image-8ef6a0f1-f05a-4a9d-8679-59c4385ad0d0.png"), path.join(OUT, "cat-cleaning.png"), 640, 800);
await writeCover(path.join(SRC, "image-5301fdf6-4cb5-4a10-8086-152a268d4079.png"), path.join(OUT, "cat-painting.png"), 640, 800);
await writeCover(path.join(SRC, "image-df4f2954-1718-452c-b521-795961df48ea.png"), path.join(OUT, "cat-appliance.png"), 640, 800);

// Stats avatars
await writeCover(path.join(SRC, "image-a036f180-604d-4595-87c9-d06c702a2454.png"), path.join(OUT, "avatar-1.png"), 160, 160);
await writeCover(path.join(SRC, "image-437decba-7613-468c-b8bc-f744b05dad8a.png"), path.join(OUT, "avatar-2.png"), 160, 160);
await safeWrite(
  sharp(path.join(SRC, "image-8bc3137d-a5d1-45ab-bbc2-d0beabcd118c.png"))
    .resize(160, 160, { fit: "cover", position: "top" })
    .png(),
  path.join(OUT, "avatar-3.png"),
);

console.log("done — new African-face asset filenames written");
