// buildExtension.js

const fs = require("fs");
const path = require("path");

function copyDirectorySync(sourceDir, destinationDir) {
  try {
    fs.cpSync(sourceDir, destinationDir, { recursive: true });
    console.log('Directory copied successfully!');
  } catch (err) {
    console.error('Error copying directory:', err);
  }
}

const target = process.argv[2]; // 'chrome', 'opera', or 'firefox'
const validTargets = ["chrome", "opera", "firefox"];

if (!validTargets.includes(target)) {
  console.error(`Usage: node buildExtension.js <${validTargets.join("|")}>`);
  process.exit(1);
}

// Load base manifest
const manifestDir = path.join(__dirname, "manifest");
const baseManifest = JSON.parse(
  fs.readFileSync(path.join(manifestDir, "base.json"), "utf-8")
);

let merged;

// For Chrome & Opera: apply chromium.json + browser-specific
if (target === "chrome" || target === "opera") {
  const chromiumFragment = JSON.parse(
    fs.readFileSync(path.join(manifestDir, "chromium.json"), "utf-8")
  );
  // const specific = JSON.parse(
  //   fs.readFileSync(path.join(manifestDir, `${target}.json`), "utf-8")
  // );
  merged = { ...baseManifest, ...chromiumFragment }; //, ...specific
} else { // For Firefox: apply only firefox.json
  const firefoxFragment = JSON.parse(
    fs.readFileSync(path.join(manifestDir, "firefox.json"), "utf-8")
  );
  merged = { ...baseManifest, ...firefoxFragment };
}

// Write out merged manifest
const outDir = path.join(__dirname, "dist", target);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(merged, null, 2),
  "utf-8"
);

// Copy source files
copyDirectorySync('src/base', outDir);

// Copy target-specific source files
if (target === "chrome" || target === "opera") {
  copyDirectorySync('src/chromium', outDir);
} else {
  copyDirectorySync('src/firefox', outDir);
}

console.log(`✅ Built ${target} extension in ${outDir}`);
