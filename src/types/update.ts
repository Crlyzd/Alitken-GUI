export interface UpdateInfo {
  available: boolean;
  is_store_build?: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
  release_notes_url: string;
  release_name: string;
}

export interface UpdateProgressPayload {
  status: string;
  percent: number;
  downloaded_mb: number;
  total_mb: number;
  speed_mbps: number;
}
