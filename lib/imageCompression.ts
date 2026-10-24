/**
 * Client-Side Smart Image Compression Utility
 * Automatically converts raw phone photos/scans (3 MB - 8 MB)
 * into lightweight, high-clarity WebP format (40 KB - 100 KB)
 * saving 90% - 98% of Supabase Storage space.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1, default: 0.82
  outputFormat?: "image/webp" | "image/jpeg";
}

/**
 * Compresses an image File using HTML5 Canvas API in the browser.
 * Non-image files (e.g. PDFs) are returned untouched safely.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // If not a browser environment or not an image (e.g. PDF documents), return original
  if (typeof window === "undefined" || !file || !file.type.startsWith("image/")) {
    return file;
  }

  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    outputFormat = "image/webp",
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate new dimensions maintaining strict aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      // Smooth downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // If converting to JPEG, add white background for PNG transparency
      if (outputFormat === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // If compression somehow produced a larger file, keep original
          if (blob.size >= file.size && file.type === outputFormat) {
            resolve(file);
            return;
          }

          const ext = outputFormat === "image/webp" ? "webp" : "jpg";
          const originalName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
          const newFileName = `${originalName}.${ext}`;

          const compressedFile = new File([blob], newFileName, {
            type: outputFormat,
            lastModified: Date.now(),
          });

          // Log compression result for developer diagnostics
          const savedPercent = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);
          console.log(
            `[ImageCompression] ✅ Compressed: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ➔ ${compressedFile.name} (${(compressedFile.size / 1024).toFixed(1)} KB) | Saved: ${savedPercent}%`
          );

          resolve(compressedFile);
        },
        outputFormat,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fallback to original on error without breaking workflow
    };

    img.src = objectUrl;
  });
}

/**
 * Preset for Student Passport Photos & School Logos
 * Optimal size: 600x600 px (300 DPI ready for ID cards & marksheets, ~35 KB - 60 KB)
 */
export async function compressAvatarPhoto(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 600,
    maxHeight: 600,
    quality: 0.85,
    outputFormat: "image/webp",
  });
}

/**
 * Preset for Official Documents (Aadhaar Card, Birth Certificate, Payment Receipts)
 * Optimal size: 1600x1600 px (Crystal clear text readability, ~80 KB - 150 KB)
 */
export async function compressDocumentScan(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    outputFormat: "image/webp",
  });
}
