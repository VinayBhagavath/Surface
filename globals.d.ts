// Allow side-effect CSS imports under bare `tsc --noEmit` (Next handles these at
// build time; this keeps the standalone typecheck green).
declare module "*.css";
