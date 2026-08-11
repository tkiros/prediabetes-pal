import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  isPrivatePantryBlobUrlForOrder,
  MAX_PANTRY_PHOTO_BYTES,
  readPrivatePantryPhotoDataUrl
} from "../../../lib/server/pantry/blob-access";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const PHOTO_URL = `https://pal.private.blob.vercel-storage.com/pantry/${ORDER_ID}/photo-AbCdEf123456.jpg`;

function privateBlobResult(
  body: Uint8Array,
  options: { contentType?: string; size?: number; url?: string } = {}
) {
  return {
    statusCode: 200 as const,
    stream: new Response(Buffer.from(body)).body!,
    headers: new Headers(),
    blob: {
      url: options.url ?? PHOTO_URL,
      downloadUrl: options.url ?? PHOTO_URL,
      pathname: `pantry/${ORDER_ID}/photo-AbCdEf123456.jpg`,
      contentDisposition: "inline",
      cacheControl: "public, max-age=0",
      uploadedAt: new Date("2026-07-22T00:00:00.000Z"),
      etag: "etag",
      contentType: options.contentType ?? "image/jpeg",
      size: options.size ?? body.byteLength
    }
  };
}

describe("private Pantry Blob access", () => {
  it("binds a randomized private URL to its exact order", () => {
    expect(isPrivatePantryBlobUrlForOrder(PHOTO_URL, ORDER_ID)).toBe(true);
    expect(
      isPrivatePantryBlobUrlForOrder(
        PHOTO_URL,
        "22222222-2222-4222-8222-222222222222"
      )
    ).toBe(false);

    for (const invalid of [
      PHOTO_URL.replace(".private.", ".public."),
      `${PHOTO_URL}?token=leak`,
      PHOTO_URL.replace("photo-AbCdEf123456.jpg", "photo.jpg"),
      PHOTO_URL.replace("/pantry/", "/other/")
    ]) {
      expect(isPrivatePantryBlobUrlForOrder(invalid, ORDER_ID)).toBe(false);
    }
  });

  it("authenticates the read and produces a bounded data URL", async () => {
    const bytes = new TextEncoder().encode("jpeg-bytes");
    const getBlob = vi.fn().mockResolvedValue(privateBlobResult(bytes));

    const result = await readPrivatePantryPhotoDataUrl(PHOTO_URL, {
      token: "private-store-token",
      getBlob
    });

    expect(result).toBe(
      `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`
    );
    expect(getBlob).toHaveBeenCalledWith(
      PHOTO_URL,
      expect.objectContaining({
        access: "private",
        token: "private-store-token",
        abortSignal: expect.any(AbortSignal)
      })
    );
  });

  it("rejects wrong objects, media types, and declared oversize before model use", async () => {
    const bytes = new Uint8Array([1]);

    await expect(
      readPrivatePantryPhotoDataUrl(PHOTO_URL, {
        token: "token",
        getBlob: vi
          .fn()
          .mockResolvedValue(privateBlobResult(bytes, { url: `${PHOTO_URL}-other` }))
      })
    ).rejects.toThrow(/not found/i);

    await expect(
      readPrivatePantryPhotoDataUrl(PHOTO_URL, {
        token: "token",
        getBlob: vi
          .fn()
          .mockResolvedValue(privateBlobResult(bytes, { contentType: "text/html" }))
      })
    ).rejects.toThrow(/unsupported/i);

    await expect(
      readPrivatePantryPhotoDataUrl(PHOTO_URL, {
        token: "token",
        getBlob: vi.fn().mockResolvedValue(
          privateBlobResult(bytes, {
            size: MAX_PANTRY_PHOTO_BYTES + 1
          })
        )
      })
    ).rejects.toThrow(/size limit/i);
  });
});
