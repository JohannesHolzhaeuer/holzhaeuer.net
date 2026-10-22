import { readFile, writeFile } from "node:fs/promises";

const FILE = ".well-known/security.txt";
const REFRESH_DAYS = 365;
const MIN_VALIDITY_DAYS = 90;
const REQUIRED_FIELDS = ["contact", "expires", "canonical"];

const fix = process.argv.includes("--fix");

const content = await readFile(FILE, "utf8");
const fields = new Map();

for (const line of content.split(/\r?\n/)) {
	if (!line || line.startsWith("#")) {
		continue;
	}

	const separator = line.indexOf(":");
	if (separator === -1) {
		continue;
	}

	fields.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
}

const missing = REQUIRED_FIELDS.filter((field) => !fields.has(field));
if (missing.length > 0) {
	console.error(`security.txt is missing required field(s): ${missing.join(", ")}`);
	process.exit(1);
}

const expires = new Date(fields.get("expires"));
if (Number.isNaN(expires.getTime())) {
	console.error(`security.txt has an invalid Expires value: ${fields.get("expires")}`);
	process.exit(1);
}

const daysLeft = (expires.getTime() - Date.now()) / 86_400_000;

if (daysLeft >= MIN_VALIDITY_DAYS) {
	console.log(`security.txt is valid for another ${Math.floor(daysLeft)} days.`);
	process.exit(0);
}

const nextExpiry = new Date(Date.now() + REFRESH_DAYS * 86_400_000).toISOString();

if (!fix) {
	console.error(
		`security.txt expires in ${Math.floor(daysLeft)} days. Run "npm run security:refresh" to extend it.`,
	);
	process.exit(1);
}

const updated = content.replace(/^Expires:.*$/m, `Expires: ${nextExpiry}`);
await writeFile(FILE, updated);
console.log(`Updated security.txt Expires to ${nextExpiry}.`);
