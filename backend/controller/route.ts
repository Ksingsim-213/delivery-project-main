import express from "express";
import { conn } from "../dbconnect";

export const router = express.Router();

const RESTAURANT = {
  lat: 16.245,
  lng: 103.25,
  name: "ร้านข้าวกล่องเดลิเวอรี",
};

const MAX_BOXES_PER_DRIVER = 10;
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";

const clampValue = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const toNumber = (value: number | string | null | undefined, fallback = 0) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
};

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

type StopRow = {
  order_id: number;
  customer_id: number;
  quantity: number;
  status?: string | null;
  customer_name: string;
  customer_phone: string;
  lat: number | string;
  lng: number | string;
};

type DeliveryStop = {
  order_id: number;
  customer_id: number;
  status: string | null;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  lat: number;
  lng: number;
};

type DriverRoute = {
  driver_id: number;
  total_boxes: number;
  total_distance_km: number;
  total_duration_minutes: number;
  return_duration_minutes: number;
  sequence: Array<{
    order_id: number;
    customer_id: number;
    status: string | null;
    customer_name: string;
    customer_phone: string;
    quantity: number;
    lat: number;
    lng: number;
    distance_from_previous_km: number;
    duration_from_previous_minutes: number;
  }>;
  restaurant: typeof RESTAURANT;
};

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    duration: number;
    legs: Array<{ duration: number }>;
  }>;
};

class RouteEstimateError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RouteEstimateError";
  }
}

const estimateDriverTimes = async (driver: DriverRoute): Promise<DriverRoute> => {
  if (driver.sequence.length === 0) {
    return driver;
  }

  const coordinates = [
    RESTAURANT,
    ...driver.sequence,
    RESTAURANT,
  ]
    .map(({ lat, lng }) => `${lng},${lat}`)
    .join(";");
  let response: Response;
  try {
    response = await fetch(`${OSRM_ROUTE_URL}/${coordinates}?overview=false&steps=false`, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new RouteEstimateError("OSRM request could not be completed", { cause: error });
  }
  if (!response.ok) {
    throw new RouteEstimateError(`OSRM request failed with status ${response.status}`);
  }

  let result: OsrmRouteResponse;
  try {
    result = (await response.json()) as OsrmRouteResponse;
  } catch (error) {
    throw new RouteEstimateError("OSRM returned an invalid response", { cause: error });
  }
  const route = result.routes?.[0];
  if (
    result.code !== "Ok" ||
    !route ||
    route.legs.length !== driver.sequence.length + 1 ||
    !Number.isFinite(route.duration) ||
    route.legs.some((leg) => !Number.isFinite(leg.duration) || leg.duration < 0)
  ) {
    throw new RouteEstimateError("OSRM did not return valid route durations");
  }

  const legMinutes = route.legs.map((leg) => Math.ceil(leg.duration / 60));
  return {
    ...driver,
    sequence: driver.sequence.map((stop, index) => ({
      ...stop,
      duration_from_previous_minutes: legMinutes[index]!,
    })),
    return_duration_minutes: legMinutes[legMinutes.length - 1]!,
    total_duration_minutes: Math.ceil(route.duration / 60),
  };
};

const buildRouteSequence = (stops: DeliveryStop[]) => {
  if (stops.length === 0) {
    return {
      sequence: [],
      totalDistanceKm: 0,
    };
  }

  const remaining = [...stops];
  let current = { lat: RESTAURANT.lat, lng: RESTAURANT.lng };
  const sequence: DriverRoute["sequence"] = [];
  let totalDistanceKm = 0;

  while (remaining.length > 0) {
    let nextStop = remaining[0]!;
    let shortestDistance = Number.POSITIVE_INFINITY;

    for (const stop of remaining) {
      const distance = haversineKm(current.lat, current.lng, stop.lat, stop.lng);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nextStop = stop;
      }
    }

    const distanceToStop = haversineKm(current.lat, current.lng, nextStop.lat, nextStop.lng);
    totalDistanceKm += distanceToStop;

    sequence.push({
      order_id: nextStop.order_id,
      customer_id: nextStop.customer_id,
      status: nextStop.status,
      customer_name: nextStop.customer_name,
      customer_phone: nextStop.customer_phone,
      quantity: nextStop.quantity,
      lat: nextStop.lat,
      lng: nextStop.lng,
      distance_from_previous_km: Number(distanceToStop.toFixed(2)),
      duration_from_previous_minutes: 0,
    });

    const index = remaining.findIndex((stop) => stop.order_id === nextStop.order_id);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
    current = { lat: nextStop.lat, lng: nextStop.lng };
  }

  const returnDistance = haversineKm(current.lat, current.lng, RESTAURANT.lat, RESTAURANT.lng);
  totalDistanceKm += returnDistance;

  return {
    sequence,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
  };
};

const loadActiveOrders = async (): Promise<StopRow[]> => {
  const [rows] = await conn.query(
    `
      SELECT 
        orders.id AS order_id,
        orders.customer_id,
        orders.quantity,
        orders.status,
        customers.name AS customer_name,
        customers.phone AS customer_phone,
        customers.lat,
        customers.lng
      FROM orders
      INNER JOIN customers ON customers.id = orders.customer_id
      WHERE orders.status IS NULL OR orders.status IN ('pending', 'processing', 'ready')
      ORDER BY orders.id ASC
    `
  );

  return (rows as StopRow[]) ?? [];
};

const buildDriverAssignments = (orders: StopRow[], driverCountInput: number) => {
  const driverCount = Math.max(1, clampValue(driverCountInput, 1, 10));
  const driverState: Array<{
    driver_id: number;
    total_boxes: number;
    stops: DeliveryStop[];
  }> = Array.from({ length: driverCount }, (_, index) => ({
    driver_id: index + 1,
    total_boxes: 0,
    stops: [],
  }));

  const normalizedOrders = [...orders]
    .map((order) => ({
      order_id: Number(order.order_id),
      customer_id: Number(order.customer_id),
      status: order.status ?? null,
      customer_name: String(order.customer_name),
      customer_phone: String(order.customer_phone),
      quantity: Math.max(1, toNumber(order.quantity, 0)),
      lat: toNumber(order.lat, RESTAURANT.lat),
      lng: toNumber(order.lng, RESTAURANT.lng),
    }))
    .sort((a, b) => {
      const byQuantity = b.quantity - a.quantity;
      if (byQuantity !== 0) return byQuantity;
      return (
        haversineKm(RESTAURANT.lat, RESTAURANT.lng, b.lat, b.lng) -
        haversineKm(RESTAURANT.lat, RESTAURANT.lng, a.lat, a.lng)
      );
    });

  for (const order of normalizedOrders) {
    let bestDriver: (typeof driverState)[number] | null = driverState[0] ?? null;
    let bestCost = Number.POSITIVE_INFINITY;

    driverState.forEach((driver) => {
      if (driver.total_boxes + order.quantity > MAX_BOXES_PER_DRIVER) {
        return;
      }

      const provisionalStops = [...driver.stops, order];
      const projectedRoute = buildRouteSequence(provisionalStops);
      const cost = projectedRoute.totalDistanceKm;

      if (
        bestDriver === null ||
        cost < bestCost ||
        (cost === bestCost && driver.total_boxes < bestDriver.total_boxes)
      ) {
        bestCost = cost;
        bestDriver = driver;
      }
    });

    if (bestDriver === null || bestDriver.total_boxes + order.quantity > MAX_BOXES_PER_DRIVER) {
      const newDriver = {
        driver_id: driverState.length + 1,
        total_boxes: 0,
        stops: [] as DeliveryStop[],
      };
      driverState.push(newDriver);
      bestDriver = newDriver;
    }

    bestDriver.stops.push(order);
    bestDriver.total_boxes += order.quantity;
  }

  return driverState
    .filter((driver) => driver.stops.length > 0)
    .map((driver) => {
      const route = buildRouteSequence(driver.stops);
      return {
        driver_id: driver.driver_id,
        total_boxes: driver.total_boxes,
        total_distance_km: route.totalDistanceKm,
        total_duration_minutes: 0,
        return_duration_minutes: 0,
        sequence: route.sequence,
        restaurant: RESTAURANT,
      } satisfies DriverRoute;
    });
};

const getRoutePlan = async (requestedDrivers: number) => {
  const orders = await loadActiveOrders();

  if (orders.length === 0) {
    return {
      success: true,
      drivers: [],
      restaurant: RESTAURANT,
      total_orders: 0,
      total_boxes: 0,
      total_distance_km: 0,
      total_duration_minutes: 0,
    };
  }

  const driverPlans = buildDriverAssignments(orders, requestedDrivers);
  const estimatedDriverPlans = await Promise.all(driverPlans.map(estimateDriverTimes));

  return {
    success: true,
    drivers: estimatedDriverPlans,
    restaurant: RESTAURANT,
    total_orders: orders.length,
    total_boxes: estimatedDriverPlans.reduce((sum, item) => sum + item.total_boxes, 0),
    total_distance_km: estimatedDriverPlans.reduce((sum, item) => sum + item.total_distance_km, 0),
    total_duration_minutes: estimatedDriverPlans.reduce(
      (sum, item) => sum + item.total_duration_minutes,
      0,
    ),
  };
};

router.get("/", async (_req, res) => {
  try {
    const driverCount = Number((_req.query.drivers as string | undefined) ?? "3");
    const result = await getRoutePlan(driverCount);
    res.status(200).json(result);
  } catch (error) {
    console.error("Route planning error:", error);
    const isEstimateError = error instanceof RouteEstimateError;
    res.status(isEstimateError ? 502 : 500).json({
      success: false,
      error: isEstimateError
        ? "ไม่สามารถคำนวณเวลาเดินทางด้วย OSRM ได้"
        : "ไม่สามารถคำนวณแผนเส้นทางได้",
    });
  }
});

router.get("/plan", async (req, res) => {
  try {
    const driverCount = Number((req.query.drivers as string | undefined) ?? "3");
    const result = await getRoutePlan(driverCount);
    res.status(200).json(result);
  } catch (error) {
    console.error("Plan error:", error);
    const isEstimateError = error instanceof RouteEstimateError;
    res.status(isEstimateError ? 502 : 500).json({
      success: false,
      error: isEstimateError
        ? "ไม่สามารถคำนวณเวลาเดินทางด้วย OSRM ได้"
        : "ไม่สามารถจัดเส้นทางได้",
    });
  }
});

router.get("/driver/:driverId", async (req, res) => {
  try {
    const driverId = Number(req.params.driverId ?? "1");
    const driverCount = Number((req.query.drivers as string | undefined) ?? "3");
    const routePlan = await getRoutePlan(driverCount);
    const driver = routePlan.drivers.find((item) => item.driver_id === driverId);

    if (!driver) {
      return res.status(404).json({ success: false, error: "ไม่พบข้อมูลใบงานสำหรับไรเดอร์คนนี้" });
    }

    res.status(200).json({
      success: true,
      driver,
      restaurant: RESTAURANT,
    });
  } catch (error) {
    console.error("Driver route error:", error);
    const isEstimateError = error instanceof RouteEstimateError;
    res.status(isEstimateError ? 502 : 500).json({
      success: false,
      error: isEstimateError
        ? "ไม่สามารถคำนวณเวลาเดินทางด้วย OSRM ได้"
        : "ไม่สามารถโหลดใบงานไรเดอร์ได้",
    });
  }
});