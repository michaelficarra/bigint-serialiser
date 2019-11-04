const SIGNIFICANT_BITS = 7n,
  CONTINUE = 1n << SIGNIFICANT_BITS,
  REST_MASK = CONTINUE - 1n;

const DEFAULT_OPTIONS = {
  startingWidth: 2,
  maximumWidth: 8,
  growthFunction: x => x + 2,
}

const OLD_DEFAULT_OPTIONS = {
  startingWidth: 1,
  maximumWidth: 1,
  growthFunction: x => x,
}

function encode(value, options) {
  let out = { length: Infinity };
  out.length = encodeInto(value, out, 0, options);
  return Uint8Array.from(out);
}

function encodeInto(value, outArray, offset = 0, options = OLD_DEFAULT_OPTIONS) {
  if (options.startingWidth < 1) {
    throw new Error('invalid starting width');
  }
  let currentWidth = options.startingWidth;

  value = BigInt(value);

  if (value < 0n) {
    value = -value;
    --value;
    value <<= 1n;
    value |= 1n;
  } else {
    value <<= 1n;
  }

  do {
    for (let innerOffset = currentWidth; innerOffset > 1; --innerOffset) {
      if (offset >= outArray.length) {
        throw new Error('insufficient space');
      }

      outArray[offset] = Number(value & 0xFFn);
      value >>= 8n;
      ++offset;
    }

    if (offset >= outArray.length) {
      throw new Error('insufficient space');
    }

    let continueBit = value > 0x7Fn ? 0x80n : 0n;
    outArray[offset] = Number((value & 0x7Fn) | continueBit);
    value >>= 7n;
    --value;
    ++offset;

    if (currentWidth < options.maximumWidth) {
      currentWidth = Math.min(options.maximumWidth, options.growthFunction(currentWidth));
      if (currentWidth < 1) {
        throw new Error('invalid growth function');
      }
    }
  } while (value >= 0n);

  return offset;
}

function decode(outArray, offset = 0) {
  return decodeWithOffset(outArray, offset).value;
}

function decodeWithOffset(outArray, startingOffset = 0) {
  let finalOffset = startingOffset;
  while (finalOffset < outArray.length - 1 && (outArray[finalOffset] & 0x80) === 0x80) {
    ++finalOffset;
  }

  let value = -1n;
  for (let offset = finalOffset; offset >= startingOffset; --offset) {
    ++value;
    value <<= SIGNIFICANT_BITS;
    value |= BigInt(outArray[offset]) & REST_MASK;
  }

  if ((value & 1n) === 1n) {
    value >>= 1n;
    ++value;
    value = -value;
  } else {
    value >>= 1n;
  }

  return {
    value,
    followingOffset: finalOffset + 1,
  };
}

module.exports = {
  encode,
  encodeInto,
  decode,
  decodeWithOffset,
};
