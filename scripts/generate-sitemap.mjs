import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(path.join(root, "config.js"), "utf8");
const projectUrl = config.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1]?.replace(/\/$/, "");
const apiKey = config.match(/\bkey\s*:\s*["']([^"']+)["']/)?.[1];

if (!projectUrl || !apiKey || /PASTE|YOUR_/i.test(apiKey)) {
  throw new Error("Could not read the Supabase URL and publishable key from config.js.");
}

const pageUrls = [
  "https://3pedalsauto.co.ke/",
  "https://3pedalsauto.co.ke/inventory",
  "https://3pedalsauto.co.ke/dealers.html",
  "https://3pedalsauto.co.ke/garage.html",
];

const listingIds = [];
const pageSize = 1000;
let offset = 0;

while (true) {
  const endpoint = new URL("/rest/v1/listings", projectUrl);
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("status", "eq.approved");
  endpoint.searchParams.set("order", "created_at.desc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Range: `${offset}-${offset + pageSize - 1}`,
      "Range-Unit": "items",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase listings request failed (${response.status}): ${details}`);
  }

  const batch = await response.json();
  if (!Array.isArray(batch)) {
    throw new Error("Supabase returned an unexpected response while generating the sitemap.");
  }

  for (const listing of batch) {
    if (typeof listing.id === "string" && listing.id.length > 0) {
      listingIds.push(listing.id);
    }
  }

  if (batch.length < pageSize) break;
  offset += pageSize;
}

const vehicleUrls = [...new Set(listingIds)].sort().map((id) => {
  const url = new URL("https://3pedalsauto.co.ke/vehicle.html");
  url.searchParams.set("id", id);
  return url.toString();
});

const allUrls = [...new Set([...pageUrls, ...vehicleUrls])];
const xmlEscape = (value) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...allUrls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");

writeFileSync(path.join(root, "sitemap.xml"), sitemap, "utf8");
console.log(`Generated sitemap.xml with ${pageUrls.length} main pages and ${vehicleUrls.length} approved vehicle pages.`);
