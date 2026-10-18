import { readFileSync, writeFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = (process.env.GSC_PROPERTY_URL || "https://3pedalsauto.co.ke/").trim();
const credentialsText = process.env.GSC_SERVICE_ACCOUNT_JSON;

if (!credentialsText) {
  throw new Error("Missing GSC_SERVICE_ACCOUNT_JSON GitHub Actions secret. Add a Google Cloud service-account JSON key.");
}

let credentials;
try {
  credentials = JSON.parse(credentialsText);
} catch {
  throw new Error("GSC_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the complete service-account JSON key into the GitHub secret.");
}
if (!credentials.client_email || !credentials.private_key) {
  throw new Error("The service-account JSON must contain client_email and private_key.");
}

const base64url = (value) => Buffer.from(value).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const jwtHeader = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const jwtClaims = base64url(JSON.stringify({
  iss: credentials.client_email,
  scope: "https://www.googleapis.com/auth/webmasters.readonly",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
}));
const unsignedJwt = jwtHeader + "." + jwtClaims;
const signer = createSign("RSA-SHA256");
signer.update(unsignedJwt);
signer.end();
const assertion = unsignedJwt + "." + signer.sign(credentials.private_key, "base64url");

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
if (!tokenResponse.ok) {
  throw new Error(`Google OAuth token request failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
}
const { access_token: accessToken } = await tokenResponse.json();
if (!accessToken) throw new Error("Google OAuth did not return an access token.");

const sitemapResponse = await fetch("https://3pedalsauto.co.ke/sitemap.xml", { cache: "no-store" });
if (!sitemapResponse.ok) throw new Error(`Could not fetch the live sitemap (${sitemapResponse.status}).`);
const sitemapXml = await sitemapResponse.text();
const urls = [...sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
  .map((match) => match[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
  .filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === "https://3pedalsauto.co.ke" &&
        parsed.pathname.endsWith("/journal.html") &&
        parsed.searchParams.has("id");
    } catch {
      return false;
    }
  });

if (!urls.length) {
  throw new Error("No published Journal article URLs with IDs were found in the live sitemap. Check the sitemap generator and published articles.");
}

const inspectEndpoint = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const results = [];
for (const inspectionUrl of [...new Set(urls)]) {
  const response = await fetch(inspectEndpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode: "en-US" }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`URL Inspection API failed for ${inspectionUrl} (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const result = payload.inspectionResult?.indexStatusResult || {};
  const coverage = result.coverageState || "Unknown";
  const verdict = result.verdict || "UNKNOWN";
  const indexed = /indexed/i.test(coverage) && !/not indexed/i.test(coverage);
  results.push({
    url: inspectionUrl,
    indexed,
    verdict,
    coverage,
    indexingState: result.indexingState || "Unknown",
    lastCrawlTime: result.lastCrawlTime || "Never reported",
    pageFetchState: result.pageFetchState || "Unknown",
    robotsTxtState: result.robotsTxtState || "Unknown",
    crawledAs: result.crawledAs || "Unknown",
    referringUrls: (result.referringUrls || []).join(" ; "),
    sitemap: (result.sitemap || []).join(" ; "),
  });

  console.log(`${indexed ? "INDEXED" : "NOT CONFIRMED INDEXED"} | ${coverage} | ${inspectionUrl}`);
}

const escapeCsv = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
const headers = ["status", "verdict", "coverage", "indexingState", "lastCrawlTime", "pageFetchState", "robotsTxtState", "crawledAs", "sitemap", "referringUrls", "url"];
const csv = [
  headers.join(","),
  ...results.map((row) => [
    row.indexed ? "INDEXED" : "NOT CONFIRMED INDEXED",
    row.verdict, row.coverage, row.indexingState, row.lastCrawlTime, row.pageFetchState,
    row.robotsTxtState, row.crawledAs, row.sitemap, row.referringUrls, row.url,
  ].map(escapeCsv).join(",")),
].join("\n") + "\n";
writeFileSync(path.join(root, "journal-indexing-report.csv"), csv, "utf8");

const indexedCount = results.filter((row) => row.indexed).length;
const pendingCount = results.length - indexedCount;
const checkedAt = new Date().toISOString();
const markdown = [
  "# 3 Pedals Auto KE — Journal indexing report",
  "",
  `Checked: ${checkedAt}`,
  `Search Console property: ${siteUrl}`,
  `Articles checked: ${results.length}`,
  `Reported indexed: ${indexedCount}`,
  `Not confirmed indexed: ${pendingCount}`,
  "",
  "| Status | Article URL | Search Console coverage | Last crawl |",
  "|---|---|---|---|",
  ...results.map((row) => `| ${row.indexed ? "Indexed" : "Check"} | [Open article](${row.url}) | ${row.coverage.replace(/\|/g, "\\|")} | ${row.lastCrawlTime} |`),
  "",
  "Note: URL Inspection reports Google's latest known index status; a result that is not confirmed indexed is not proof that the article can never be indexed. Review the coverage, fetch, and robots states in the CSV before taking action.",
  "",
].join("\n");
writeFileSync(path.join(root, "journal-indexing-report.md"), markdown, "utf8");

console.log(`\nJournal indexing check complete: ${indexedCount}/${results.length} reported indexed; ${pendingCount} not confirmed indexed.`);
console.log("Reports written to journal-indexing-report.md and journal-indexing-report.csv.");
