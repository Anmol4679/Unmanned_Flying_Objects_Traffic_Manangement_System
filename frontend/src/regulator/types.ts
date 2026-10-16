export interface OperatorItem {
  operator_id: number;
  name: string;
  license_no: string;
  role: "FLEET_OPERATOR" | "REGULATOR" | "DISPATCHER";
  is_suspended?: boolean;
}

export interface AuditLogItem {
  id: number;
  actor_id: number | null;
  action: string | null;
  entity: string | null;
  entity_id: number | null;
  created_at: string;
}

