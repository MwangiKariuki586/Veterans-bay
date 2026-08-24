import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoots = [join(process.cwd(), "src", "app"), join(process.cwd(), "src", "components")];
const forbiddenWeightUtilities = ["font-" + "bold", "font-extra" + "bold", "font-" + "black"];
const heavyArbitraryWeight = /font-\[(?:[7-9]00|[1-9][0-9]{3,})\]/;
const heavyDeclaredWeight = /font(?:-weight|Weight)\s*[:=]\s*["']?(?:bold|[7-9]00|[1-9][0-9]{3,})\b/;

function renderedSourceFiles(root: string) {
  return readdirSync(root, { encoding: "utf8", recursive: true })
    .filter((entry) => [".css", ".tsx"].includes(extname(entry)))
    .map((entry) => join(root, entry));
}

describe("typography weight contract", () => {
  it("keeps rendered page typography at semibold or below", () => {
    const violations = sourceRoots.flatMap((root) =>
      renderedSourceFiles(root).flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const forbiddenUtility = forbiddenWeightUtilities.find((utility) => source.includes(utility));

        return forbiddenUtility || heavyArbitraryWeight.test(source) || heavyDeclaredWeight.test(source)
          ? [file.replace(`${process.cwd()}\\`, "")]
          : [];
      }),
    );

    expect(violations).toEqual([]);
  });

  it("loads only the supported Poppins weights", () => {
    const rootLayout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

    expect(rootLayout).toContain('weight: ["400", "500", "600"]');
  });
});
