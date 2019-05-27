import test from 'ava';
import { encode, decode, encodeInto, decodeWithOffset } from './index.js';

function render(byteArray) {
  if (byteArray != null && Symbol.iterator in byteArray) {
    let contents = [...byteArray].map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(', ');
    return `[${contents}]`;
  }
  return byteArray;
}

// function assertOracle(t, oracle, n) {
//   let expected = oracle(n);
//   assertSanity(t, expected);
//   let actual = encode(n);
//   t.deepEqual(actual, expected, `${n}: ${render(actual)}, ${render(expected)}`);
// }

function assertSanity(t, byteArray) {
  t.true(byteArray.length >= 1);
  for (let i = 0; i < byteArray.length - 1; ++i) {
    t.is(byteArray[i] & 0x80, 0x80, `highest bit sanity (offset ${i}): ${render(byteArray)}`);
  }
  t.is(byteArray[byteArray.length - 1] & 0x80, 0, `highest bit sanity (offset 0): ${render(byteArray)}`);
}

function assertRoundTrip(t, n) {
  t.is(typeof n, 'bigint');
  let encoded = encode(n);
  assertSanity(t, encoded);
  let actual = decode(encoded);
  t.is(typeof actual, 'bigint');
  t.is(actual, n, `round-trip ${n}: encoded as ${render(encoded)}, decoded as ${actual}`);
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


test('fixed bidirectional expectations', t => {
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
  ]);

  for (let [n, byteArray] of EXPECTATIONS) {
    t.is(typeof n, 'bigint');
    assertSanity(t, byteArray);

    {
      let expected = byteArray;
      let actual = encode(n);
      assertSanity(t, actual);
      t.true(actual instanceof Uint8Array);
      t.deepEqual([...actual], expected, `encode ${n}: actual ${render(actual)}, expected ${render(expected)}`);
    }

    {
      let expected = n;
      let actual = decode(byteArray);
      t.is(typeof actual, 'bigint');
      t.deepEqual(actual, expected, `decode ${render(byteArray)}: actual ${actual}, expected ${expected}`);
    }
  }
});

test('snapshots', t => {
  const SNAPSHOTS = [
    137n,
    233n,
    8192n,
    16383n,
    16384n,
    534362n,
    106903n,
    2097151n,
    2097152n,
    134217728n,
    268435454n,
    268435455n,
    268435456n,
    6536456364n,
  ]

  for (let n of SNAPSHOTS) {
    t.is(typeof n, 'bigint');
    assertRoundTrip(t, n);
    assertRoundTrip(t, -n);
  }
  t.snapshot(new Map([].concat.apply([], SNAPSHOTS.map(n => [[n, encode(n)], [-n, encode(-n)]]))));
});

test('small numbers', t => {
  for (let n = 0n; n < BigInt(1e5); ++n) {
    assertRoundTrip(t, n);
    assertRoundTrip(t, -n);
  }
});

test('big numbers', t => {
  let n = 1n;
  let last = 0n;
  for (let i = 1; i < 500; ++i) {
    assertRoundTrip(t, n);
    assertRoundTrip(t, -n);
    [last, n] = [n, n + last];
  }
});

test('random numbers', t => {
  for (let i = 0; i < 1e3; ++i) {
    let n = BigInt(Math.floor(Math.random() * Math.pow(2, 53)));
    assertRoundTrip(t, n);
    assertRoundTrip(t, -n);
  }
});

test('decoding coverage', t => {
  let min = 0n;
  let max = 0n;
  let seen = new Map;

  for (let length = 1; length < 4; ++length) {
    for (let byteArray of byteArraysOfLength(length)) {
      assertSanity(t, byteArray);
      let decoded = decode(byteArray);
      if (decoded < min) {
        min = decoded;
      }
      if (decoded > max) {
        max = decoded;
      }
      t.false(seen.has(decoded), `multiple representations for ${decoded}: ${render(byteArray)} and ${render(seen.get(decoded))}`);
      seen.set(decoded, byteArray);
    }
  }

  for (let i = min + 1n; i < max; ++i) {
    t.true(seen.has(i), `no representation for ${i}`);
  }
});

test('decode with offset', t => {
  let byteArray = [0x80, 0x80, 0x80, 0x80, 0x00, 0x80, 0x80, 0x00];
  t.deepEqual({ value: 135274560n, followingOffset: 5 }, decodeWithOffset(byteArray));

  t.deepEqual({ value: 135274560n, followingOffset: 5 }, decodeWithOffset(byteArray, 0));
  t.deepEqual({ value: 1056832n, followingOffset: 5 }, decodeWithOffset(byteArray, 1));
  t.deepEqual({ value: 8256n, followingOffset: 5 }, decodeWithOffset(byteArray, 2));
  t.deepEqual({ value: 64n, followingOffset: 5 }, decodeWithOffset(byteArray, 3));
  t.deepEqual({ value: 0n, followingOffset: 5 }, decodeWithOffset(byteArray, 4));
  t.deepEqual({ value: 8256n, followingOffset: 8 }, decodeWithOffset(byteArray, 5));
  t.deepEqual({ value: 64n, followingOffset: 8 }, decodeWithOffset(byteArray, 6));
  t.deepEqual({ value: 0n, followingOffset: 8 }, decodeWithOffset(byteArray, 7));

  t.is(135274560n, decode(byteArray, 0));
  t.is(1056832n, decode(byteArray, 1));
  t.is(8256n, decode(byteArray, 2));
  t.is(64n, decode(byteArray, 3));
  t.is(0n, decode(byteArray, 4));
  t.is(8256n, decode(byteArray, 5));
  t.is(64n, decode(byteArray, 6));
  t.is(0n, decode(byteArray, 7));
});
