const fs = require('fs');
const path = 'app/driver-navigate.tsx';
let c = fs.readFileSync(path, 'utf8');

const CRLF = '\r\n';
const LF = '\n';

// 1. Add useAuth import after useRide import
const rideImport = "import { useRide } from '@/context/RideContext';" + CRLF;
const authImport = "import { useAuth } from '@/context/AuthContext';" + CRLF;
if (!c.includes('useAuth')) {
  c = c.replace(rideImport, authImport + rideImport);
}

// 2. Add recordCompletedRide destructure after useRide destructure line
const rideDestructure = 'const { currentRide, driverLocation, markArrived, startJourney, completeRide, cancelRide } = useRide();';
if (!c.includes('recordCompletedRide')) {
  c = c.replace(rideDestructure, rideDestructure + CRLF + '  const { recordCompletedRide } = useAuth();');
}

// 3. Insert fare capture before completeRide in handleCompleteRide
// The exact string from inspection: completeRide('driver');\n          router.replace('/(driver)');
const oldComplete = "completeRide('driver');" + LF + "          router.replace('/(driver)');";
const newComplete =
  "const fare = currentRide?.agreedFare ?? 0;" + LF +
  "          completeRide('driver');" + LF +
  "          void recordCompletedRide(fare);" + LF +
  "          router.replace('/(driver)');";
c = c.replace(oldComplete, newComplete);

fs.writeFileSync(path, c, 'utf8');
console.log('useAuth:', c.includes('useAuth'));
console.log('recordCompletedRide:', c.includes('recordCompletedRide'));
console.log('fare capture:', c.includes('agreedFare ?? 0'));
