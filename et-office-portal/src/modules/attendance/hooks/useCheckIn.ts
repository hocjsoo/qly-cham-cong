import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkIn } from "../services/attendanceService";
import { useGeolocation } from "@/shared/hooks/useGeolocation";

/** Hook Check In — luôn qua useMutation để có loading/error state + toast nhất quán. */
export function useCheckIn(employeeId: string | undefined) {
  const queryClient = useQueryClient();
  const { getPosition } = useGeolocation();

  return useMutation({
    mutationFn: async () => {
      const { lat, lng } = await getPosition();
      return checkIn({
        lat,
        lng,
        deviceId: getDeviceId(),
        userAgent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", "today", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
    },
  });
}

/** ID thiết bị đơn giản lưu trong localStorage — chỉ để nhận diện "thiết bị lạ" (mục 10 kiến trúc), không phải cơ chế bảo mật tuyệt đối. */
function getDeviceId(): string {
  const key = "et_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
