const ADVERTISING_MARKER_RE =
  /(?<![\p{L}\p{N}_])(?:erid|инн)(?![\p{L}\p{N}_])/iu;

export function containsAdvertisingMarker(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  return ADVERTISING_MARKER_RE.test(value);
}

export function isAdvertisingPostGroup(posts) {
  if (!Array.isArray(posts)) return false;
  return posts.some((post) => containsAdvertisingMarker(post?.text));
}
