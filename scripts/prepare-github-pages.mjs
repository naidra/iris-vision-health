import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const clientDir = join(process.cwd(), "dist", "client");
const serverEntryUrl = pathToFileURL(join(process.cwd(), "dist", "server", "index.js")).href;
const siteOrigin = "https://naidra.github.io";
const siteBase = "/iris-vision-health";
const routes = ["/", "/reader", "/lessons", "/about"];

const serverEntry = await import(serverEntryUrl);
const app = serverEntry.default ?? serverEntry;

async function renderRoute(route) {
  const response = await app.fetch(new Request(`${siteOrigin}${siteBase}${route}`), {}, {});
  const html = await response.text();

  if (!response.ok || !html.includes("<!DOCTYPE html>")) {
    throw new Error(`Failed to render ${route} for GitHub Pages: ${response.status}`);
  }

  return html;
}

let fallbackHtml = "";

for (const route of routes) {
  const html = await renderRoute(route);
  const routeDir = route === "/" ? clientDir : join(clientDir, route.slice(1));
  await mkdir(routeDir, { recursive: true });
  await writeFile(join(routeDir, "index.html"), html);
  if (route === "/") fallbackHtml = html;
}

await writeFile(join(clientDir, "404.html"), fallbackHtml);
await writeFile(join(clientDir, ".nojekyll"), "");
