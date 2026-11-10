// Keep multipart uploads below Vercel's 4.5 MB request limit.
export const MAX_UPLOAD = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 МБ";
export const MAX_MULTIPART = MAX_UPLOAD + 64 * 1024;
