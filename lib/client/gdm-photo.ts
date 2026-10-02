import { PLAN_PHOTO_MAX_BASE64, type PlanPhotoMime } from "../pal/gdm/plan-photo";

/** The longest edge of a sheet photo as it is sent: made smaller on the device, before upload. */
export const PHOTO_MAX_EDGE = 1600;

/** The size a photo is drawn at: its own when it fits, else scaled so its longest edge is `maxEdge`. Never enlarged. */
export function scaledSize(width: number, height: number, maxEdge: number = PHOTO_MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type PreparedPhoto = { mime: PlanPhotoMime; dataBase64: string };

/** The part of a data: URL after its comma: the base64 alone. */
function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * The photo as it is uploaded: decoded on the device, drawn no larger than
 * PHOTO_MAX_EDGE, re-encoded as a JPEG at 0.8, then base64. It rejects when
 * the device cannot decode the file (a HEIC on some browsers rejects in
 * `createImageBitmap`) or the result is still over the route's bound; the
 * page then shows the save-failed line and clears the input (G-20).
 */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) throw new Error("not encoded");
    const dataBase64 = await base64Of(blob);
    if (dataBase64.length > PLAN_PHOTO_MAX_BASE64) throw new Error("too large");
    return { mime: "image/jpeg", dataBase64 };
  } finally {
    bitmap.close();
  }
}
