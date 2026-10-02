export type OperatorRole = "FLEET_OPERATOR" | "REGULATOR" | "DISPATCHER";

export interface TokenPayload {
  id: number;
  operator_id: number;
  role: OperatorRole;
  exp?: number;
}

export interface OperatorProfile {
  operator_id: number;
  name: string;
  license_no: string;
  role: OperatorRole;
}

export interface AuthContextType {
  token: string | null;
  user: TokenPayload | null;
  operator: OperatorProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, operatorData?: OperatorProfile) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}
