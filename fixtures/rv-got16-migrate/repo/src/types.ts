export interface Snapshot { service: string; pending: number }
export interface SnapshotResult {
  status: number;
  requestId: string | undefined;
  payload: Snapshot;
}
