import fc from "fast-check";
import { createRng } from "./rng";

const draw = (seed: number) => {
  const r = createRng(seed);
  return [r.int(0, 100), r.int(0, 100), r.int(0, 100)];
};

it("same seed gives same sequence", () =>
  fc.assert(fc.property(fc.integer(), (s) => {
    expect(draw(s)).toEqual(draw(s));
  })));

it("different seeds usually differ", () => expect(draw(1)).not.toEqual(draw(2)));

it("int stays in [min, max] and hits both ends", () => {
  const r = createRng(7);
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) {
    const v = r.int(3, 6);
    expect(v).toBeGreaterThanOrEqual(3);
    expect(v).toBeLessThanOrEqual(6);
    seen.add(v);
  }
  expect([...seen].sort()).toEqual([3, 4, 5, 6]);
});

it("normalizes odd seeds", () => {
  expect(draw(-1)).toEqual(draw(4294967295));
  expect(draw(1.9)).toEqual(draw(1));
  expect(draw(2 ** 32 + 5)).toEqual(draw(5));
});

it("shuffle keeps items and does not mutate", () => {
  const xs = [1, 2, 3, 4];
  const out = createRng(3).shuffle(xs);
  expect([...out].sort()).toEqual([1, 2, 3, 4]);
  expect(xs).toEqual([1, 2, 3, 4]);
});

it("int throws when min > max", () => expect(() => createRng(1).int(5, 4)).toThrow());
