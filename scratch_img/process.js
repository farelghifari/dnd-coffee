const { Jimp } = require("jimp");
const path = require("path");

async function main() {
    const imgPath = path.resolve(__dirname, "../public/images/story_cartoon_1.png");
    const outPath = path.resolve(__dirname, "../public/images/story_cartoon_1_transparent.png");

    console.log("Loading image...", imgPath);
    const image = await Jimp.read(imgPath);

    console.log("Processing pixels...");
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        const a = this.bitmap.data[idx + 3];

        // The image has a white background (near 255) and black lines.
        // We want to make the background completely transparent, and the lines white.
        const brightness = (r + g + b) / 3;

        if (brightness > 200) {
            // It's part of the white background. Make it transparent.
            this.bitmap.data[idx + 3] = 0; // Alpha 0
        } else {
            // It's the line art. Make it white and opaque!
            // To soften edges, use alpha relative to brightness for anti-aliasing
            // If it's pure black (0), alpha = 255. If it's greyish (e.g. 150), alpha = something lower.
            const alpha = Math.max(0, 255 - brightness);
            this.bitmap.data[idx + 0] = 249; // R
            this.bitmap.data[idx + 1] = 244; // G
            this.bitmap.data[idx + 2] = 235; // B (matching #F9F4EB)
            this.bitmap.data[idx + 3] = alpha; 
        }
    });

    console.log("Saving transparent image to:", outPath);
    await image.write(outPath);
    console.log("Done!");
}

main().catch(console.error);
