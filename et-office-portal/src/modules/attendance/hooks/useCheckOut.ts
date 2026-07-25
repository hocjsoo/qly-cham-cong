import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkOut } from "../services/attendanceService";
import { useGeolocation } from "@/shared/hooks/useGeolocation";

export function useCheckOut(employeeId: string | undefined) {
  const queryClient = useQueryClient();
  const { getPosition } = useGeolocation();

  return useMutation({
    mutationFn: async () => {
      const { lat, lng } = await getPosition();
      return checkOut({
        lat,
        lng,
        deviceId: localStorage.getItem("et_device_id") ?? "unknown",
        userAgent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", "today", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
    },
  });
}
