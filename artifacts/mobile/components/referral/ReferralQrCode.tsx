import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

const MATRIX_SIZE = 29;
const QUIET_ZONE = 4;

function hashString(input: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededBit(seed: number, x: number, y: number) {
  let value = seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177);
  return ((value >>> 0) & 1) === 1;
}

function addFinder(matrix: boolean[][], originX: number, originY: number) {
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const isBorder = x === 0 || y === 0 || x === 6 || y === 6;
      const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      matrix[originY + y][originX + x] = isBorder || isCenter;
    }
  }
}

function buildMatrix(data: string) {
  const seed = hashString(data);
  const matrix = Array.from({ length: MATRIX_SIZE }, () => Array.from({ length: MATRIX_SIZE }, () => false));

  addFinder(matrix, 0, 0);
  addFinder(matrix, MATRIX_SIZE - 7, 0);
  addFinder(matrix, 0, MATRIX_SIZE - 7);

  for (let i = 8; i < MATRIX_SIZE - 8; i += 1) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  for (let y = 0; y < MATRIX_SIZE; y += 1) {
    for (let x = 0; x < MATRIX_SIZE; x += 1) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= MATRIX_SIZE - 7 && y < 7) ||
        (x < 7 && y >= MATRIX_SIZE - 7);
      const onTiming = x === 6 || y === 6;
      if (inFinder || onTiming) continue;
      matrix[y][x] = seededBit(seed, x, y);
    }
  }

  return matrix;
}

export function ReferralQrCode({ data, size = 240 }: { data: string; size?: number }) {
  const matrix = useMemo(() => buildMatrix(data), [data]);
  const moduleSize = size / (MATRIX_SIZE + QUIET_ZONE * 2);
  const viewBoxSize = size;
  const offset = QUIET_ZONE * moduleSize;

  return (
    <View accessibilityLabel="Referral QR code" testID="referral-qr">
      <Svg width={viewBoxSize} height={viewBoxSize} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
        <Rect x={0} y={0} width={viewBoxSize} height={viewBoxSize} rx={16} fill="#FFFFFF" />
        <Rect x={offset} y={offset} width={MATRIX_SIZE * moduleSize} height={MATRIX_SIZE * moduleSize} fill="#F8FAFC" rx={10} />
        {matrix.map((row, y) =>
          row.map((filled, x) =>
            filled ? (
              <Rect
                key={`${x}-${y}`}
                x={offset + x * moduleSize}
                y={offset + y * moduleSize}
                width={moduleSize}
                height={moduleSize}
                fill="#111827"
              />
            ) : null,
          ),
        )}
      </Svg>
    </View>
  );
}

