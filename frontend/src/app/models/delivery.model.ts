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
  status?: string | null;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  lat: number;
  lng: number;
  distance_from_previous_km: number;
  duration_from_previous_minutes: number;
}

export interface DriverRoute {
  driver_id: number;
  total_boxes: number;
  total_distance_km: number;
  total_duration_minutes: number;
  return_duration_minutes: number;
  geometry: Array<[number, number]>;
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
  total_duration_minutes: number;
}

export const DEPOT: [number, number] = [16.25074917, 103.25005929];
export const CAPACITY = 10;

export const ROUTE_STYLES = [
  { color: '#A43E32', dashArray: undefined, lineStyle: 'solid', name: 'แดงอิฐ' },
  { color: '#173B63', dashArray: '12 6', lineStyle: 'dashed', name: 'น้ำเงินเข้ม' },
  { color: '#39734A', dashArray: '2 6', lineStyle: 'dotted', name: 'เขียวใบไม้' },
  { color: '#B45618', dashArray: '12 4 2 4', lineStyle: 'dashed', name: 'ส้ม' },
  { color: '#62538C', dashArray: '6 3', lineStyle: 'dashed', name: 'ม่วงอมน้ำเงิน' },
  { color: '#806400', dashArray: '1 5', lineStyle: 'dotted', name: 'เหลืองมัสตาร์ด' },
  { color: '#236A67', dashArray: '14 4 4 4', lineStyle: 'dashed', name: 'เขียวอมฟ้า' },
  { color: '#694C36', dashArray: '3 3', lineStyle: 'dashed', name: 'น้ำตาล' },
  { color: '#863A61', dashArray: '8 2 2 2', lineStyle: 'dashed', name: 'แดงม่วง' },
  { color: '#39424A', dashArray: '15 3 2 3 2 3', lineStyle: 'dashed', name: 'เทาเข้ม' },
] as const;
