
/**
 * Generates a 64-bit perceptual hash (pHash) for an image.
 */
export async function generatePHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context failed');

      canvas.width = 16;
      canvas.height = 16;
      ctx.drawImage(img, 0, 0, 16, 16);
      
      const imageData = ctx.getImageData(0, 0, 16, 16);
      const data = imageData.data;
      const grayscale = new Uint8Array(256);

      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayscale[i / 4] = avg;
        sum += avg;
      }

      const mean = sum / 256;
      let hash = "";
      for (let i = 0; i < 256; i++) {
        hash += grayscale[i] >= mean ? "1" : "0";
      }

      let hex = "";
      for (let i = 0; i < hash.length; i += 4) {
        hex += parseInt(hash.substring(i, i + 4), 2).toString(16);
      }

      URL.revokeObjectURL(url);
      resolve(hex);
    };

    img.onerror = () => reject('Image load failed');
    img.src = url;
  });
}

/**
 * Enhances a receipt image for better OCR extraction.
 * Applies grayscale, contrast boost, and sharpening.
 */
export async function enhanceReceiptImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context failed');

      // Maintain aspect ratio but cap max dimension to 1600px for speed
      const MAX_DIM = 1600;
      let width = img.width;
      let height = img.height;
      if (width > height && width > MAX_DIM) {
        height *= MAX_DIM / width;
        width = MAX_DIM;
      } else if (height > MAX_DIM) {
        width *= MAX_DIM / height;
        height = MAX_DIM;
      }

      canvas.width = width;
      canvas.height = height;
      
      // 1. Draw original
      ctx.drawImage(img, 0, 0, width, height);
      
      // 2. Filter: Moderate Contrast Grayscale (better for thin text)
      ctx.filter = 'grayscale(100%) contrast(130%) brightness(105%)';
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';

      // 3. Export as optimized WebP (or JPEG if WebP not supported)
      const enhancedDataUrl = canvas.toDataURL('image/webp', 0.85);
      const [header, base64Data] = enhancedDataUrl.split(',');
      const actualMimeType = header.split(':')[1].split(';')[0];
      
      URL.revokeObjectURL(url);
      resolve({ base64: base64Data, mimeType: actualMimeType });
    };

    img.onerror = () => reject('Image enhancement failed');
    img.src = url;
  });
}

/**
 * Calculates Hamming distance between two hex hashes.
 */
export function getHashDistance(h1: string, h2: string): number {
  if (h1.length !== h2.length) return 64;
  let distance = 0;
  for (let i = 0; i < h1.length; i++) {
    const v1 = parseInt(h1[i], 16);
    const v2 = parseInt(h2[i], 16);
    let xor = v1 ^ v2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}
