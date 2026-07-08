import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'qrcode';

export function ReferralQrCode({ data, size = 240 }: { data: string; size?: number }) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
      const qrSize = qr.modules.size;
      const result: boolean[][] = [];
      for (let y = 0; y < qrSize; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < qrSize; x++) {
          row.push(qr.modules.get(y, x) === 1);
        }
        result.push(row);
      }
      return result;
    } catch (e) {
      return [[true]];
    }
  }, [data]);

  const matrixSize = matrix.length;
  const moduleSize = size / matrixSize;

  return (
    <View accessibilityLabel="Referral QR code" testID="referral-qr">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {matrix.map((row, y) =>
          row.map((filled, x) =>
            filled ? (
              <Rect
                key={`${x}-${y}`}
                x={x * moduleSize}
                y={y * moduleSize}
                width={moduleSize}
                height={moduleSize}
                fill="#000000"
              />
            ) : null,
          ),
        )}
      </Svg>
    </View>
  );
}
