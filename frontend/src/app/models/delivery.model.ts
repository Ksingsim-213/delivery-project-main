export interface Customer {
  id?: number;
  name: string;
  phone: string;
  lat: number;
  lng: number;
}

export interface Order {
  id?: number;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  boxes: number;
  status?: string | null;
}

export const DEPOT: [number, number] = [16.245, 103.25];
export const CAPACITY = 10;
