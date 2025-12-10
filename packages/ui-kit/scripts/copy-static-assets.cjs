const { readdir, mkdir, copyFile } = require("fs/promises");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith(".css")) {
        const relative = path.relative(srcDir, entryPath);
        const destinationPath = path.join(distDir, relative);
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await copyFile(entryPath, destinationPath);
      }
    }),
  );
}

walk(srcDir).catch((error) => {
  console.error("Failed to copy static assets:", error);
  process.exit(1);
});
