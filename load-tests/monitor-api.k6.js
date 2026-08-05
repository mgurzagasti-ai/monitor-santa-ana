import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const MODE = __ENV.MODE || "smoke";
const DEVICE_ID = __ENV.DEVICE_ID || "17752";
const ROUTE_HOURS = __ENV.ROUTE_HOURS || "6";

const failedChecks = new Rate("failed_checks");
const apiErrors = new Counter("api_errors");
const fleetDuration = new Trend("fleet_duration");

const scenarios = {
  smoke: {
    executor: "constant-vus",
    vus: 1,
    duration: "30s"
  },
  load: {
    executor: "ramping-vus",
    stages: [
      { duration: "1m", target: 25 },
      { duration: "3m", target: 100 },
      { duration: "1m", target: 0 }
    ]
  },
  stress: {
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 100 },
      { duration: "3m", target: 300 },
      { duration: "3m", target: 600 },
      { duration: "2m", target: 0 }
    ]
  },
  spike: {
    executor: "ramping-vus",
    stages: [
      { duration: "30s", target: 100 },
      { duration: "30s", target: 1000 },
      { duration: "1m", target: 1000 },
      { duration: "30s", target: 0 }
    ]
  },
  fivek: {
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 500 },
      { duration: "3m", target: 1500 },
      { duration: "5m", target: 5000 },
      { duration: "5m", target: 5000 },
      { duration: "3m", target: 0 }
    ]
  }
};

export const options = {
  scenarios: {
    api: scenarios[MODE] || scenarios.smoke
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    failed_checks: ["rate<0.01"],
    fleet_duration: ["p(95)<1500"]
  },
  userAgent: "k6-santa-ana-monitor"
};

export default function () {
  group("fleet current position", () => {
    const response = http.get(`${BASE_URL}/api/fleet`, {
      tags: { endpoint: "fleet" }
    });
    fleetDuration.add(response.timings.duration);
    recordChecks(response, [
      ["status is 200", response.status === 200],
      ["has vehicles array", response.json("vehicles") !== undefined],
      ["has updatedAt", Boolean(response.json("updatedAt"))]
    ]);
  });

  group("assignments", () => {
    const response = http.get(`${BASE_URL}/api/assignments`, {
      tags: { endpoint: "assignments" }
    });
    recordChecks(response, [
      ["status is 200", response.status === 200],
      ["has assignments array", response.json("assignments") !== undefined]
    ]);
  });

  if (__ITER % 10 === 0) {
    group("line routes cached", () => {
      const response = http.get(`${BASE_URL}/api/line-routes`, {
        tags: { endpoint: "line-routes" }
      });
      recordChecks(response, [
        ["status is 200", response.status === 200],
        ["has routes array", response.json("routes") !== undefined]
      ]);
    });
  }

  if (__ITER % 20 === 0) {
    group("route history", () => {
      const response = http.get(`${BASE_URL}/api/route?deviceId=${DEVICE_ID}&hours=${ROUTE_HOURS}`, {
        tags: { endpoint: "route" }
      });
      recordChecks(response, [
        ["status is 200", response.status === 200],
        ["has points array", response.json("points") !== undefined]
      ]);
    });
  }

  sleep(Math.random() * 2 + 1);
}

function recordChecks(response, assertions) {
  const passed = check(response, Object.fromEntries(assertions));
  failedChecks.add(!passed);
  if (response.status >= 400 || response.error) {
    apiErrors.add(1);
  }
}
