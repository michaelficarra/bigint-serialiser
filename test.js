const assert = require('assert');
const varint = require('varint');
const varintBigint = require('./index.js');

function render(byteArray) {
  if (byteArray != null && Symbol.iterator in byteArray) {
    let contents = [...byteArray].map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(', ');
    return `[${contents}]`;
  }
  return byteArray;
}

const EXPECTATIONS = new Map([
  // [0n, [0b000]],
  // [1n, [0b010]],
  // [-1n, [0b011]],
  // [2n, [0b100]],
  // [-2n, [0b101]],
  // [3n, [0b110]],
  // [-3n, [0b111]],

  // [127n, [0x7F]],
  // [128n, [0x80, 0x01]],
  // [137n, [0x89, 0x01]],
  // [233n, [0xE9, 0x01]],
  // [8192n, [0x80, 0x40]],
  // [16383n, [0xFF, 0x7F]],
  // [16384n, [0x80, 0x80, 0x01]],
  // [534362n, [0xDA, 0xCE, 0x20]],
  // [106903n, [0x97, 0xC3, 0x06]],
  // [2097151n, [0xFF, 0xFF, 0x7F]],
  // [2097152n, [0x80, 0x80, 0x80, 0x01]],
  // [134217728n, [0x80, 0x80, 0x80, 0x40]],
  // [268435454n, [0xFE, 0xFF, 0xFF, 0x7F]],
  // [268435455n, [0xFF, 0xFF, 0xFF, 0x7F]],
  // [268435456n, [0x80, 0x80, 0x80, 0x80, 0x01]],
  // [6536456364n, [0xAC, 0xD1, 0xE9, 0xAC, 0x18]],
]);

// function assertOracle(oracle, n) {
//   let expected = oracle(n);
//   assertSanity(expected);
//   let actual = varintBigint.encode(n);
//   assert.deepStrictEqual(actual, expected, `${n}: ${render(actual)}, ${render(expected)}`);
// }

function assertSanity(byteArray) {
  assert.ok(byteArray.length >= 1);
  for (let i = 0; i < byteArray.length - 1; ++i) {
    assert.strictEqual(byteArray[i] & 0x80, 0x80, `highest bit sanity (offset ${i}): ${render(byteArray)}`);
  }
  assert.strictEqual(byteArray[byteArray.length - 1] & 0x80, 0, `highest bit sanity (offset 0): ${render(byteArray)}`);
}

for (let [n, byteArray] of EXPECTATIONS) {
  assert.strictEqual(typeof n, 'bigint');
  assertSanity(byteArray);

  {
    let expected = byteArray;
    let actual = varintBigint.encode(n);
    assertSanity(actual);
    assert.ok(actual instanceof Uint8Array);
    assert.deepStrictEqual([...actual], expected, `encode ${n}: actual ${render(actual)}, expected ${render(expected)}`);
  }

  {
    let expected = n;
    let actual = varintBigint.decode(byteArray);
    assert.strictEqual(typeof actual, 'bigint');
    assert.deepStrictEqual(actual, expected, `decode ${render(byteArray)}: actual ${actual}, expected ${expected}`);
  }
}

function assertRoundTrip(n) {
  assert.strictEqual(typeof n, 'bigint');
  let encoded = varintBigint.encode(n);
  assertSanity(encoded);
  let actual = varintBigint.decode(encoded);
  assert.strictEqual(typeof actual, 'bigint');
  assert.strictEqual(actual, n, `round-trip ${n}: encoded as ${render(encoded)}, decoded as ${actual}`);
}

let step = 0n;
for (let n = 0n; n < BigInt(1e6); n += step) {
  assertRoundTrip(n);
  assertRoundTrip(-n);
  ++step;
}

for (let i = 0; i < 1e6; ++i) {
  let n = BigInt(Math.floor(Math.random() * Math.pow(2, 53)));
  assertRoundTrip(n);
  assertRoundTrip(-n);
}

{
  let encoded = [0x02, 0x80, 0x80];
  let actual = varintBigint.decode(encoded);
  assert.strictEqual(typeof actual, 'bigint');
  console.log(actual);
}
