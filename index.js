const SIGNIFICANT_BITS = 7n,
  CONTINUE = 1n << SIGNIFICANT_BITS,
  REST_MASK = CONTINUE - 1n;

function encode(value) {
  let out = [];
  encodeInto(value, out);
  return Uint8Array.from(out);
}

function encodeInto(value, byteArray, offset = 0) {
  value = BigInt(value);

  if (value < 0) {
    value = -value;
    value <<= 1n;
    value |= 1n;
  } else {
    value <<= 1n;
  }

  while (value >= CONTINUE) {
    byteArray[offset] = Number((value & REST_MASK) | CONTINUE);
    value >>= SIGNIFICANT_BITS;
    ++offset;
  }

  byteArray[offset] = Number(value);

  return offset;
}

function decode(byteArray, offset = 0) {
  return decodeWithOffset(byteArray, offset).value;
}

function decodeWithOffset(byteArray, offset = 0) {
  let value = 0n;
  let shift = 0n;
  let negative = false;

  while (offset < byteArray.length) {
    let b = BigInt(byteArray[offset]);
    ++offset;
    if (b === 0n) break;
    value |= (b & REST_MASK) << shift;
    if ((b & CONTINUE) !== CONTINUE) break;
    shift += SIGNIFICANT_BITS;
  }

  if ((value & 1n) === 1n) {
    value >>= 1n;
    value = -value;
  } else {
    value >>= 1n;
  }

  return {
    value,
    offset,
  };
}

module.exports = {
  encode,
  encodeInto,
  decode,
};
