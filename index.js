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

function decodeWithOffset(byteArray, startingOffset = 0) {
  let finalOffset = startingOffset;
  while (finalOffset < byteArray.length && (byteArray[finalOffset] & 0x80) === 0x80) {
    ++finalOffset;
  }
  ++finalOffset;

  let value = 0n;
  for (let offset = finalOffset - 1; offset >= startingOffset; --offset) {
    let b = BigInt(byteArray[offset]);
    value <<= SIGNIFICANT_BITS;
    value |= b & REST_MASK;
  }

  if ((value & 1n) === 1n) {
    value >>= 1n;
    value = -value;
  } else {
    value >>= 1n;
  }

  return {
    value,
    finalOffset,
  };
}

module.exports = {
  encode,
  encodeInto,
  decode,
};
