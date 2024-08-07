import * as sharp from 'sharp';

export const generateSvg = async (image: sharp.Sharp, pixel_width: number) => {
    const { data, info } = await image.raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

    const pixels = [];
    for (let x = 8; x < 16; x++) {
        for (let y = 8; y < 16; y++) {
            const pixelIndex = (y * info.width + x) * info.channels;
            pixels.push(`<rect x="${(x - 8) * (pixel_width * 0.865) + (pixel_width / 2)}" y="${(y - 8) * (pixel_width * 0.865) + (pixel_width / 2)}" width="${pixel_width}" height="${pixel_width}" fill="rgba(${data[pixelIndex]}, ${data[pixelIndex + 1]}, ${data[pixelIndex + 2]}, ${data[pixelIndex + 3]})" />`);
        }
    }

    for (let x = 40; x < 48; x++) {
        for (let y = 8; y < 16; y++) {
            const pixelIndex = (y * info.width + x) * info.channels;
            pixels.push(`<rect x="${(x - 40) * pixel_width}" y="${(y - 8) * pixel_width}" width="${pixel_width}" height="${pixel_width}" fill="rgba(${data[pixelIndex]}, ${data[pixelIndex + 1]}, ${data[pixelIndex + 2]}, ${data[pixelIndex + 3]})" />`);
        }
    }

    const result =
        `<svg width="${pixel_width * 8}" height="${pixel_width * 8}" xmlns="http://www.w3.org/2000/svg">\n` +
        `${pixels.join('\n')}\n` +
        `</svg>`;

    return result;
}