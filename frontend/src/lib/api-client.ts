export type AssessmentStatus =
  | "draft"
  | "uploaded"
  | "quality_check"
  | "queued"
  | "processing"
  | "completed"
  | "rejected"
  | "failed"
  | "cancelled";
export type Assessment = {
  id: string;
  case_id: string;
  photo_path: string;
  status: AssessmentStatus;
  quality_status: "pending" | "passed" | "rejected" | "unavailable";
  model_status: "unavailable" | "demo_only" | "ready" | "failed";
  model_version: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}
