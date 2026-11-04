export function seededRandom(initial = 271828) {
  let seed = initial >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
