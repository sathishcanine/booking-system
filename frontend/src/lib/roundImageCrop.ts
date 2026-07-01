export type RoundCropState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const ROUND_CROP_VIEW_SIZE = 280;

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function coverScaleForView(
  img: HTMLImageElement,
  viewSize: number,
  userScale: number
): number {
  return Math.max(viewSize / img.width, viewSize / img.height) * userScale;
}

export function cropRoundImage(
  img: HTMLImageElement,
  viewSize: number,
  state: RoundCropState,
  outputSize = 512
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas unavailable"));
  }

  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.clip();

  const ratio = outputSize / viewSize;
  const coverScale = coverScaleForView(img, viewSize, state.scale);
  const dw = img.width * coverScale;
  const dh = img.height * coverScale;
  const x = viewSize / 2 - dw / 2 + state.offsetX;
  const y = viewSize / 2 - dh / 2 + state.offsetY;

  ctx.drawImage(img, x * ratio, y * ratio, dw * ratio, dh * ratio);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
}
