import type { DecisionOutcome } from "../api/routes/schemas.js";

export interface DepartmentLeaveRecord {
  request_id: string;
  employee_id: string;
  department: string;
  start_date: string;
  end_date: string;
  outcome: DecisionOutcome;
}

const departmentLeaveRecords = new Map<string, DepartmentLeaveRecord>();

export function recordDepartmentLeaveRequest(record: DepartmentLeaveRecord): void {
  departmentLeaveRecords.set(record.request_id, record);
}

export function countOverlappingDepartmentRequests(input: {
  employee_id: string;
  department: string;
  start_date: string;
  end_date: string;
}): number {
  return [...departmentLeaveRecords.values()].filter((record) =>
    record.department === input.department
    && record.employee_id !== input.employee_id
    && record.outcome !== "REJECT"
    && record.start_date <= input.end_date
    && record.end_date >= input.start_date,
  ).length;
}
