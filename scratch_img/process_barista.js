const { Jimp } = require("jimp");
const path = require("path");

async function main() {
    const imgPath = "C:\\Users\\BUSINESS ASIASISTEM\\.gemini\\antigravity\\brain\\1d85195f-e4b7-4b75-902e-f72e7dbf49c7\\line_art_barista_transparent_1777071849701.png";
    const outPath = path.resolve(__dirname, "../public/images/human_barista_transparent.png");

    console.log("Loading generated image...");
    const image = await Jimp.read(imgPath);

    console.log("Processing pixels...");
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];

        const brightness = (r + g + b) / 3;

        if (brightness > 240) {
            this.bitmap.data[idx + 3] = 0; 
        } else {
            // Dark brown ink
            this.bitmap.data[idx + 0] = 42; 
            this.bitmap.data[idx + 1] = 27; 
            this.bitmap.data[idx + 2] = 20; 
            // Invert alpha: darker = more opaque
            this.bitmap.data[idx + 3] = 255 - brightness;
        }
    });

    console.log("Saving to:", outPath);
    await image.write(outPath);
}

main().catch(console.error);
