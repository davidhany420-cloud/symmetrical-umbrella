const L = 'ar-EG-u-nu-latn';
export const egp = (n: number) => `${Math.round(n).toLocaleString('en-US')} ج`;
export const num = (n: number) => n.toLocaleString('en-US');

export function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'دلوقتي';
  const m = Math.round(s / 60);
  if (m < 60) return `من ${num(m)} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `من ${num(h)} ساعة`;
  return new Date(t).toLocaleDateString(L, { day: 'numeric', month: 'short' });
}

export const clock = (t: number) =>
  new Date(t).toLocaleTimeString(L, { hour: 'numeric', minute: '2-digit' });

export const dateStr = (t: number) =>
  new Date(t).toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' });

/** Egyptian mobile: 010/011/012/015 + 8 digits */
export const validPhone = (p: string) => /^01[0125]\d{8}$/.test(normalizeDigits(p).trim());

export function normalizeDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Resize an image file to a small JPEG data URL so it fits in local storage. */
export function compressImage(file: File, max = 640, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('الصورة دي مش مدعومة'));
    };
    img.src = url;
  });
}
