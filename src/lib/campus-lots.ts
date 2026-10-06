export type LotId = "P9" | "P4" | "P8" | "Inner Circle";

// Approximate real positions of UTM parking lots (Mississauga campus).
export const lotPositions: Record<LotId, { lat: number; lng: number }> = {
  P9: { lat: 43.5516, lng: -79.6636 },
  P4: { lat: 43.5448, lng: -79.6587 },
  P8: { lat: 43.5479, lng: -79.6663 },
  "Inner Circle": { lat: 43.5476, lng: -79.6606 },
};

export const campusCenter = { lat: 43.5483, lng: -79.661 };

// Simulated hourly threat curves, hours 6:00–23:00 (18 values, 0–100).
export const forecastCurves: Record<LotId, number[]> = {
  P9: [12, 10, 9, 10, 14, 22, 35, 80, 88, 85, 66, 52, 38, 28, 18, 14, 12, 10],
  P4: [8, 7, 7, 8, 11, 17, 26, 36, 55, 62, 64, 58, 45, 33, 24, 15, 10, 9],
  P8: [5, 5, 4, 7, 25, 30, 33, 28, 20, 14, 10, 8, 7, 6, 5, 5, 4, 4],
  "Inner Circle": [10, 9, 9, 11, 16, 25, 66, 76, 78, 70, 55, 42, 30, 21, 14, 11, 10, 9],
};

export const peakWindows: Record<LotId, { start: number; end: number; label: string }> = {
  P9: { start: 13, end: 15, label: "Mon 1PM–3PM" },
  P4: { start: 14, end: 16, label: "Mon 2PM–4PM" },
  P8: { start: 10, end: 12, label: "Tue 10AM–12PM" },
  "Inner Circle": { start: 12, end: 14, label: "Mon 12PM–2PM" },
};
