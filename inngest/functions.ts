// Registry of all Inngest functions, served at /api/inngest.

import { evidencePipeline } from "@/inngest/evidence-pipeline";
import { watcher } from "@/inngest/watcher";

export const functions = [evidencePipeline, watcher];
