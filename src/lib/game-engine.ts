export type Point = { x: number; y: number };
export function neighbors(index: number, size: number): number[] {
  const x = index % size,
    y = Math.floor(index / size),
    result: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size)
        result.push((y + dy) * size + x + dx);
    }
  return result;
}
export function makeMines(
  size: number,
  count: number,
  safe: number,
  random = Math.random,
): Set<number> {
  const excluded = new Set([safe, ...neighbors(safe, size)]);
  const candidates = Array.from({ length: size * size }, (_, i) => i).filter(
    (i) => !excluded.has(i),
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return new Set(candidates.slice(0, count));
}
export function revealCells(
  index: number,
  size: number,
  mines: Set<number>,
  revealed: Set<number>,
  flags: Set<number>,
): Set<number> {
  const next = new Set(revealed),
    stack = [index];
  while (stack.length) {
    const cell = stack.pop()!;
    if (next.has(cell) || flags.has(cell) || mines.has(cell)) continue;
    next.add(cell);
    const adjacent = neighbors(cell, size);
    if (!adjacent.some((i) => mines.has(i))) stack.push(...adjacent);
  }
  return next;
}
export function nextSnake(snake: Point[], direction: Point, food: Point, size: number) {
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const ate = head.x === food.x && head.y === food.y;
  const body = ate ? snake : snake.slice(0, -1);
  const dead =
    head.x < 0 ||
    head.y < 0 ||
    head.x >= size ||
    head.y >= size ||
    body.some((p) => p.x === head.x && p.y === head.y);
  return { snake: [head, ...snake].slice(0, snake.length + (ate ? 1 : 0)), ate, dead };
}
export function spawnFood(snake: Point[], size: number, random = Math.random): Point | null {
  const empty = Array.from({ length: size * size }, (_, i) => ({
    x: i % size,
    y: Math.floor(i / size),
  })).filter((p) => !snake.some((s) => s.x === p.x && s.y === p.y));
  return empty.length ? empty[Math.floor(random() * empty.length)] : null;
}
