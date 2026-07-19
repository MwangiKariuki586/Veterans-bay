export interface HealthStatus {
  service: "veterans-bay-api";
  status: "ok";
}

export interface ReadinessStatus {
  service: "veterans-bay-api";
  status: "ready";
}

export interface DependencyStatus {
  available: boolean;
}
