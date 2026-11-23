/** Cloudinary can resize and compress on the fly: ask for a web-sized, auto-format copy instead of the 5 MB original. */
export function img(url: string, width = 800) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/") || /\/upload\/[a-z]_/.test(url)) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`);
}

const ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
export const sortSizes = (sizes: string[]) => [...sizes].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
