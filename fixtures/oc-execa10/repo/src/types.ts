export interface CommandCallbacks {
  onSpawn?: () => void;
  onExit?: (code: number | null) => void;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | undefined;
  failed: boolean;
}
