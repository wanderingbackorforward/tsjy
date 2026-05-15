from typing import Any, Literal
from pydantic import BaseModel, Field


AlertLevel = Literal["normal", "warning", "alarm", "unknown"]
RiskStatus = Literal["normal", "approaching", "inside", "passed"]


class ProjectSummary(BaseModel):
    projectId: str
    projectName: str
    contractorName: str | None = None
    sectionId: str
    sectionName: str
    startMileage: str | None = None
    endMileage: str | None = None
    lengthM: float | None = None
    tunnelForm: str | None = None
    designSpeedKmh: float | None = None
    maxBurialDepthM: float | None = None


class RingInfo(BaseModel):
    ringId: str
    sectionId: str
    ringNo: int
    workDate: str | None = None
    startMileage: str | None = None
    endMileage: str | None = None
    startMileageM: float | None = None
    endMileageM: float | None = None
    constructionStage: str | None = None
    isActual: bool = False


class RiskSource(BaseModel):
    riskSourceId: str
    sectionId: str
    riskName: str
    riskType: str | None = None
    crossingRelation: str | None = None
    startMileage: str | None = None
    endMileage: str | None = None
    startMileageM: float | None = None
    endMileageM: float | None = None
    minHorizontalDistanceM: float | None = None
    minVerticalDistanceM: float | None = None
    protectionLevel: str | None = None
    riskLevel: str | None = "medium"
    status: RiskStatus = "normal"
    distanceToStartM: float | None = None
    distanceToEndM: float | None = None
    distanceToCurrentRingM: float | None = None
    alertLevel: AlertLevel = "normal"
    monitoringPointCount: int = 0


class OperationSummary(BaseModel):
    operationId: str | None = None
    ringNo: int | None = None
    recordedAt: str | None = None
    advanceSpeed: float | None = None
    facePressure: float | None = None
    totalThrust: float | None = None
    cutterTorque: float | None = None
    cutterRotationSpeed: float | None = None
    penetration: float | None = None
    alertLevel: AlertLevel = "unknown"


class MonitoringSummary(BaseModel):
    pointCount: int = 0
    warningCount: int = 0
    alarmCount: int = 0
    maxSettlement: float = 0


class EventItem(BaseModel):
    eventId: str
    ringNo: int | None = None
    riskName: str | None = None
    eventTime: str | None = None
    eventType: str
    severity: str = "info"
    description: str | None = None
    possibleCause: str | None = None
    handlingAction: str | None = None
    closureResult: str | None = None
    responsibleParty: str | None = None


class DashboardOverview(BaseModel):
    project: ProjectSummary | None
    currentRing: RingInfo | None
    viewRing: RingInfo | None
    viewMode: Literal["current", "selected"] = "current"
    activeRiskSources: list[RiskSource] = Field(default_factory=list)
    allRiskSources: list[RiskSource] = Field(default_factory=list)
    operationSummary: OperationSummary | None
    operationTrend: list[dict[str, Any]] = Field(default_factory=list)
    monitoringSummary: MonitoringSummary
    recentEvents: list[EventItem] = Field(default_factory=list)
    dataUpdatedAt: str | None = None
