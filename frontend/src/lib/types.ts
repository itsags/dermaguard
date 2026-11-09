export type Case = { id: string; title: string; body_area: string; created_at: string }
export type Observation = { id: string; case_id: string; noted_at: string; symptoms: string[]; notes: string; photo_path: string | null }
