const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validatePortalImage(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Use a JPG, PNG or WEBP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 5MB.");
  }
}

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not process image."));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

/** Draw a square crop from an image + react-easy-crop pixel area. */
export async function getCroppedImageBlob(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  outputSize = 720,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return blobFromCanvas(canvas, "image/jpeg", 0.9);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}
