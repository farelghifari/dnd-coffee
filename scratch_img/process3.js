const { Jimp } = require("jimp");
const path = require("path");

async function main() {
    const imgPath = path.resolve(__dirname, "../public/images/semarang_coffee_doodle.png");
    const outPath = path.resolve(__dirname, "../public/images/semarang_coffee_doodle_dark.png");

    console.log("Loading image...", imgPath);
    const image = await Jimp.read(imgPath);

    console.log("Processing pixels...");
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];

        const brightness = (r + g + b) / 3;

        if (brightness > 200) {
            // White background to transparent
            this.bitmap.data[idx + 3] = 0; 
        } else {
            // Black lines stay dark brown (#2A1B14)
            const alpha = Math.max(0, 255 - brightness);
            this.bitmap.data[idx + 0] = 42;  // R for #2A
            this.bitmap.data[idx + 1] = 27;  // G for #1B
            this.bitmap.data[idx + 2] = 20;  // B for #14
            this.bitmap.data[idx + 3] = alpha; 
        }
    });

    console.log("Saving transparent image to:", outPath);
    await image.write(outPath);
    console.log("Done!");
}

main().catch(console.error);
