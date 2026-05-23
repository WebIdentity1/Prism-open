type DemoLoginEnv = {
  VITE_ENABLE_DEMO_LOGIN?: string | boolean;
};

export function isDemoLoginEnabled(env: DemoLoginEnv = import.meta.env): boolean {
  return env.VITE_ENABLE_DEMO_LOGIN === "true";
}
