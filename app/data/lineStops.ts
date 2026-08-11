export type LineStopDirection = "ida" | "vuelta" | "ambos";

export type LineStop = {
  id: string;
  lineId: string;
  name: string;
  latitude: number;
  longitude: number;
  direction: LineStopDirection;
  order?: number;
};

export const lineStops: LineStop[] = [];
