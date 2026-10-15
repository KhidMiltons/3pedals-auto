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

const listingRows = [];
const pageSize = 1000;
let offset = 0;

while (true) {
  const endpoint = new URL("/rest/v1/listings", projectUrl);
  endpoint.searchParams.set("select", "id,yard_name,seller_name,seller_type,yard_location");
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
      listingRows.push(listing);
    }
  }

  if (batch.length < pageSize) break;
  offset += pageSize;
}

const listingIds = [...new Set(listingRows.map((listing) => listing.id))];
const vehicleUrls = listingIds.sort().map((id) => {
  const url = new URL("https://3pedalsauto.co.ke/vehicle.html");
  url.searchParams.set("id", id);
  return url.toString();
});

const normalizeYardName = (name) => String(name || "")
  .trim()
  .replace(/\s+(?:ke|kenya)$/i, "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");
const yardNames = new Map();
for (const listing of listingRows) {
  const type = String(listing.seller_type || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  const explicitlyYard = ["yard", "dealer", "car yard", "car dealer", "business"].includes(type);
  const explicitlyPrivate = ["private", "private seller", "individual"].includes(type);
  const hasYardDetails = [listing.yard_name, listing.yard_location]
    .some((value) => String(value || "").trim());
  const isYard = explicitlyYard || (!explicitlyPrivate && hasYardDetails);
  const name = String(listing.yard_name || listing.seller_name || "").trim();
  const key = normalizeYardName(name);
  if (isYard && name && key && !yardNames.has(key)) yardNames.set(key, name);
}
const yardUrls = [...yardNames.values()].sort((a, b) => a.localeCompare(b)).map((name) => {
  const url = new URL("https://3pedalsauto.co.ke/yard.html");
  url.searchParams.set("name", name);
  return url.toString();
});

const allUrls = [...new Set([...pageUrls, ...yardUrls, ...vehicleUrls])];
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
console.log(`Generated sitemap.xml with ${pageUrls.length} main pages, ${yardUrls.length} dealer profiles, and ${vehicleUrls.length} approved vehicle pages.`);
