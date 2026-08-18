/**
 * Utility to compress and resize images (profile photos, institution logos, school logos, book covers)
 * so that any uploaded image regardless of original file size (e.g., 10MB+) is instantly converted
 * to a lightweight, optimized Base64 data URL (< 150KB) suitable for storage and avatar display.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export async function compressImageFile(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio-preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original base64 if canvas context not supported
          resolve(readerEvent.target?.result as string);
          return;
        }

        // Draw and smoothly resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed Base64
        const compressedBase64 = canvas.toDataURL(mimeType, quality);
        resolve(compressedBase64);
      };

      img.onerror = () => {
        // Fallback to original reader string if image loading fails
        resolve(readerEvent.target?.result as string);
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compress an existing base64 string
 */
export async function compressBase64(
  base64Str: string,
  options: CompressOptions = {}
): Promise<string> {
  if (!base64Str || !base64Str.startsWith('data:image')) {
    return base64Str;
  }

  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL(mimeType, quality));
    };

    img.onerror = () => {
      resolve(base64Str);
    };

    img.src = base64Str;
  });
}
