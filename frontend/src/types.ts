export type AlertLevel = 'normal' | 'warning' | 'alarm' | 'unknown';

export interface RingInfo {
  ringId: string;
  sectionId: string;
  ringNo: number;
  workDate?: string;
  startMileage?: string;
  endMileage?: string;
  startMileageM?: number;
  endMileageM?: number;
  constructionStage?: string;
  isActual?: boolean;
  progressPercent?: number;
}

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  contractorName?: string;
  sectionId: string;
  sectionName: string;
  startMileage?: string;
  endMileage?: string;
  lengthM?: number;
  tunnelForm?: string;
  designSpeedKmh?: number;
  maxBurialDepthM?: number;
}

export interface RiskSource {
  riskSourceId: string;
  riskName: string;
  riskType?: string;
  crossingRelation?: string;
  startMileage?: string;
  endMileage?: string;
  status: 'normal' | 'approaching' | 'inside' | 'passed';
  riskLevel?: string;
  alertLevel: AlertLevel;
  monitoringPointCount: number;
}

export interface OperationSummary {
  ringNo?: number;
  recordedAt?: string;
  advanceSpeed?: number;
  facePressure?: number;
  totalThrust?: number;
  cutterTorque?: number;
  cutterRotationSpeed?: number;
  penetration?: number;
  alertLevel?: AlertLevel;
}

export interface MonitoringSummary {
  pointCount: number;
  warningCount: number;
  alarmCount: number;
  maxSettlement: number;
}

export interface EventItem {
  eventId: string;
  ringNo?: number;
  riskName?: string;
  eventTime?: string;
  eventType: string;
  severity: string;
  description?: string;
  handlingAction?: string;
  closureResult?: string;
  responsibleParty?: string;
}

export interface DashboardOverview {
  project: ProjectSummary | null;
  currentRing: RingInfo | null;
  viewRing: RingInfo | null;
  viewMode: 'current' | 'selected';
  activeRiskSources: RiskSource[];
  allRiskSources: RiskSource[];
  operationSummary: OperationSummary | null;
  operationTrend: OperationSummary[];
  monitoringSummary: MonitoringSummary;
  recentEvents: EventItem[];
  dataUpdatedAt?: string;
}

export interface SystemStatus {
  mode: string;
  sectionId: string;
  currentRingNo: number;
  tableCounts: { tableName: string; rowCount: number; status: string; message?: string }[];
  dataQuality: { readyScore: number; checks: { key: string; name: string; ok: boolean; count: number }[] };
}
