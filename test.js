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
  [0n, [0b000]],
  [-1n, [0b001]],
  [1n, [0b010]],
  [-2n, [0b011]],
  [2n, [0b100]],
  [-3n, [0b101]],
  [3n, [0b110]],

  [-63n, [0x7D]],
  [63n, [0x7E]],
  [-64n, [0x7F]],
  [64n, [0x80, 0x00]],
  [-65n, [0x81, 0x00]],
  [65n, [0x82, 0x00]],

  [-126n, [0xFB, 0x00]],
  [126n, [0xFC, 0x00]],
  [-127n, [0xFD, 0x00]],
  [127n, [0xFE, 0x00]],
  [-128n, [0xFF, 0x00]],
  [128n, [0x80, 0x01]],
  [-129n, [0x81, 0x01]],
  [129n, [0x82, 0x01]],

  [137n, [0x92, 0x01]],
  [233n, [0xD2, 0x02]],
  [8192n, [0x80, 0x7F]],
  [16383n, [0xFE, 0xFE, 0x00]],
  [16384n, [0x80, 0xFF, 0x00]],
  [534362n, [0xB4, 0x9C, 0x40]],
  [106903n, [0xAE, 0x85, 0x0C]],
  [2097151n, [0xFE, 0xFE, 0xFE, 0x00]],
  [2097152n, [0x80, 0xFF, 0xFE, 0x00]],
  [134217728n, [0x80, 0xFF, 0xFE, 0x7E]],
  [268435454n, [0xFC, 0xFE, 0xFE, 0xFE, 0x00]],
  [268435455n, [0xFE, 0xFE, 0xFE, 0xFE, 0x00]],
  [268435456n, [0x80, 0xFF, 0xFE, 0xFE, 0x00]],
  [6536456364n, [0xD8, 0xA1, 0xD2, 0xD8, 0x2F]],
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

console.log('fixed bidirectional expectations');
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

console.log('small numbers');
for (let n = 0n; n < BigInt(1e5); ++n) {
  assertRoundTrip(n);
  assertRoundTrip(-n);
}

console.log('big numbers');
{
  let n = 1n;
  let last = 0n;
  for (let i = 1; i < 500; ++i) {
    assertRoundTrip(n);
    assertRoundTrip(-n);
    [last, n] = [n, n + last];
  }
}

console.log('random numbers');
for (let i = 0; i < 1e3; ++i) {
  let n = BigInt(Math.floor(Math.random() * Math.pow(2, 53)));
  assertRoundTrip(n);
  assertRoundTrip(-n);
}

function* byteArraysOfLength(length) {
  let arr = new Array(length).fill(0x80);
  arr[length - 1] = 0x00;

  next: while (true) {
    yield arr;
    for (let position = 0; position < length - 1; ++position) {
      if (arr[position] < 0xFF) {
        ++arr[position];
        continue next;
      } else {
        arr[position] = 0x80;
      }
    }
    let position = length - 1;
    if (arr[position] < 0x7F) {
      ++arr[position];
      continue next;
    }
    break;
  }
}

console.log('decoding coverage');
{
  let min = 0n;
  let max = 0n;
  let seen = new Map;

  for (let length = 1; length < 4; ++length) {
    for (let byteArray of byteArraysOfLength(length)) {
      assertSanity(byteArray);
      let decoded = varintBigint.decode(byteArray);
      if (decoded < min) {
        min = decoded;
      }
      if (decoded > max) {
        max = decoded;
      }
      assert.ok(!seen.has(decoded), `multiple representations for ${decoded}: ${render(byteArray)} and ${render(seen.get(decoded))}`);
      seen.set(decoded, byteArray);
    }
  }

  for (let i = min + 1n; i < max; ++i) {
    assert.ok(seen.has(i), `no representation for ${i}`);
  }
}
