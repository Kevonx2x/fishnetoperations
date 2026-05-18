import { readFileSync, writeFileSync } from "fs";

const file = "components/marketplace/fishnet-home-marketplace.tsx";
let s = readFileSync(file, "utf8");

const start = s.indexOf('              <div className="hidden" aria-hidden>');
const end = s.indexOf("              <AnimatePresence mode=\"wait\" initial={false}>");
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}
s = s.slice(0, start) + "\n" + s.slice(end);
writeFileSync(file, s);
console.log("removed", end - start, "chars");
