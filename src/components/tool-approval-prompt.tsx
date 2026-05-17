import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation'
import type { ChatAddToolApproveResponseFunction, ToolUIPart } from 'ai'

interface ToolApprovalPromptProps {
  approval: { id: string }
  state: ToolUIPart['state']
  onApprovalResponse: ChatAddToolApproveResponseFunction
}

export function ToolApprovalPrompt({ approval, state, onApprovalResponse }: ToolApprovalPromptProps) {
  return (
    <Confirmation approval={approval} state={state}>
      <ConfirmationRequest>
        <ConfirmationTitle>This tool requires your approval to run</ConfirmationTitle>
        <ConfirmationActions>
          <ConfirmationAction
            onClick={() => {
              void onApprovalResponse({ id: approval.id, approved: true })
            }}
          >
            Approve
          </ConfirmationAction>
          <ConfirmationAction
            variant="destructive"
            onClick={() => {
              void onApprovalResponse({ id: approval.id, approved: false })
            }}
          >
            Deny
          </ConfirmationAction>
        </ConfirmationActions>
      </ConfirmationRequest>
      <ConfirmationAccepted>Approved. Executing tool.</ConfirmationAccepted>
      <ConfirmationRejected>Denied. Tool will not run.</ConfirmationRejected>
    </Confirmation>
  )
}
