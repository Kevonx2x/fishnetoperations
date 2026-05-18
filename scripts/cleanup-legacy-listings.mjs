import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../components/marketplace/fishnet-home-marketplace.tsx");
let text = fs.readFileSync(file, "utf8");

// Remove orphan fragment + legacy comment block
const legacyStart = text.indexOf("            <>\n            {/* LEGACY_REMOVED");
const trustStart = text.indexOf("            {/* 7. WHY FISHNET TRUST SECTION */}");
if (legacyStart === -1 || trustStart === -1) {
  console.error("markers not found", { legacyStart, trustStart });
  process.exit(1);
}
text = text.slice(0, legacyStart) + text.slice(trustStart);

// Remove isResultsMode wrapper around trust/footer
text = text.replace(
  /\n            \{\!isResultsMode \? \(\n            <>\n            \{\/\* 7\. WHY FISHNET TRUST SECTION \*\/\}/,
  "\n            {/* 7. WHY FISHNET TRUST SECTION */}",
);
text = text.replace(/\n            <\/>\n            \) : null\}\n          <\/>\n        \) : null\}\n      <\/main>/, "\n          </>\n        ) : null}\n      </main>");

// Remove delete marker if left from partial edit
text = text.replace(/\s*__DELETE_MARKER_START__\s*/g, "");

fs.writeFileSync(file, text);
console.log("cleaned", file);
