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

export interface RouteStop {
  order_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  lat: number;
  lng: number;
  distance_from_previous_km: number;
}

export interface DriverRoute {
  driver_id: number;
  total_boxes: number;
  total_distance_km: number;
  sequence: RouteStop[];
  restaurant: {
    lat: number;
    lng: number;
    name: string;
  };
}

export interface RoutePlan {
  success: boolean;
  drivers: DriverRoute[];
  restaurant: DriverRoute['restaurant'];
  total_orders: number;
  total_boxes: number;
  total_distance_km: number;
}

export const DEPOT: [number, number] = [16.245, 103.25];
export const CAPACITY = 10;
