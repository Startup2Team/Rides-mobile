export function assertRideSequenceNumber(sequenceNumber: number) {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error('Ride event sequenceNumber must be a positive integer');
  }
  return sequenceNumber;
}

export function nextRideSequenceNumber(currentSequenceNumber: number) {
  if (!Number.isInteger(currentSequenceNumber) || currentSequenceNumber < 0) {
    throw new Error('Current ride sequenceNumber must be a non-negative integer');
  }
  return currentSequenceNumber + 1;
}
