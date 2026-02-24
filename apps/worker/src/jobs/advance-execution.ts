import { advanceExecution } from '../engine/executor'
import type { AdvanceExecutionPayload } from '@omnilink/shared'

export async function handleAdvanceExecution(payload: AdvanceExecutionPayload): Promise<void> {
  await advanceExecution(payload.execution_id, payload.trigger ?? 'start')
}
