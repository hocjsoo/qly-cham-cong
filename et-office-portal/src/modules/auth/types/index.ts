import type { Employee } from "@/shared/types";

export interface AuthState {
  firebaseUid: string | null;
  employee: Employee | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
