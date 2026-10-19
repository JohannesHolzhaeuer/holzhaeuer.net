import { writeFile } from "node:fs/promises";

import sharp from "sharp";

const AVATAR_URL = "https://secure.gravatar.com/avatar/31757332e6ba0bf09d872977d95d4c9e?s=512";
const BACKGROUND = "#e7ecef";
const ROUND_SUPERSAMPLE = 4;

async function fetchAvatar() {
	const attempts = 3;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(AVATAR_URL, {
				headers: { "user-agent": "holzhaeuer.net icon generator" },
				signal: AbortSignal.timeout(30000),
			});
			if (!response.ok) {
				throw new Error(`Gravatar responded with HTTP ${response.status}`);
			}

			const data = Buffer.from(await response.arrayBuffer());
			if (data.length === 0) {
				throw new Error("Gravatar returned an empty image");
			}
			return data;
		} catch (error) {
			if (attempt === attempts) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
		}
	}

	throw new Error("unreachable");
}

function buildIco(images) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	const directory = Buffer.alloc(16 * images.length);
	let offset = header.length + directory.length;

	images.forEach(({ size, data }, index) => {
		const entry = index * 16;
		directory.writeUInt8(size >= 256 ? 0 : size, entry);
		directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
		directory.writeUInt8(0, entry + 2);
		directory.writeUInt8(0, entry + 3);
		directory.writeUInt16LE(1, entry + 4);
		directory.writeUInt16LE(32, entry + 6);
		directory.writeUInt32LE(data.length, entry + 8);
		directory.writeUInt32LE(offset, entry + 12);
		offset += data.length;
	});

	return Buffer.concat([header, directory, ...images.map(({ data }) => data)]);
}

const avatar = await fetchAvatar();

function square(size) {
	return sharp(avatar)
		.rotate()
		.resize(size, size, { fit: "cover" })
		.flatten({ background: BACKGROUND })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function round(size) {
	const large = size * ROUND_SUPERSAMPLE;
	const circle = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${large}" height="${large}"><circle cx="${large / 2}" cy="${large / 2}" r="${large / 2}" fill="#fff"/></svg>`,
	);
	const masked = await sharp(avatar)
		.rotate()
		.resize(large, large, { fit: "cover" })
		.composite([{ input: circle, blend: "dest-in" }])
		.png()
		.toBuffer();

	return sharp(masked)
		.resize(size, size, { kernel: "lanczos3" })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

await writeFile("favicon-16x16.png", await round(16));
await writeFile("favicon-32x32.png", await round(32));

const favicon64 = await round(64);
await writeFile(
	"favicon.svg",
	`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">\n\t<image width="64" height="64" href="data:image/png;base64,${favicon64.toString("base64")}"/>\n</svg>\n`,
);

const icoImages = [];
for (const size of [16, 32, 48]) {
	icoImages.push({ size, data: await round(size) });
}
await writeFile("favicon.ico", buildIco(icoImages));

await writeFile("apple-touch-icon.png", await square(180));
await writeFile("android-chrome-192x192.png", await square(192));
await writeFile("android-chrome-512x512.png", await square(512));

for (const size of [70, 144, 150, 310]) {
	await writeFile(`mstile-${size}x${size}.png`, await square(size));
}

const wideTile = await sharp(avatar)
	.rotate()
	.resize(150, 150, { fit: "cover" })
	.png({ compressionLevel: 9 })
	.toBuffer();
const wideCanvas = await sharp({
	create: { width: 310, height: 150, channels: 3, background: BACKGROUND },
})
	.composite([{ input: wideTile, left: 80, top: 0 }])
	.png({ compressionLevel: 9 })
	.toBuffer();
await writeFile("mstile-310x150.png", wideCanvas);

console.log("Generated favicons, app icons and Windows tiles.");
