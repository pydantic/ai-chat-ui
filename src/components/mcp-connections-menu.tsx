import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PlugZapIcon } from 'lucide-react'

import { PromptInputButton } from './ai-elements/prompt-input'

export interface McpConnection {
  id: string
  name: string
}

interface McpConnectionsMenuProps {
  connections: McpConnection[]
  selectedConnectionIds: string[]
  onSelectedConnectionIdsChange: (connectionIds: string[]) => void
}

export function McpConnectionsMenu({
  connections,
  selectedConnectionIds,
  onSelectedConnectionIdsChange,
}: McpConnectionsMenuProps) {
  const toggleConnection = (connectionId: string) => {
    onSelectedConnectionIdsChange(
      selectedConnectionIds.includes(connectionId)
        ? selectedConnectionIds.filter((id) => id !== connectionId)
        : [...selectedConnectionIds, connectionId],
    )
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <PromptInputButton
              variant={selectedConnectionIds.length > 0 ? 'default' : 'outline'}
              aria-label="MCP connections"
              aria-pressed={selectedConnectionIds.length > 0}
            >
              <PlugZapIcon className="size-4" />
              {selectedConnectionIds.length > 0 && <span>{selectedConnectionIds.length}</span>}
            </PromptInputButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>MCP connections</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        {connections.map((connection) => {
          const selected = selectedConnectionIds.includes(connection.id)
          return (
            <div
              key={connection.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
              onClick={() => {
                toggleConnection(connection.id)
              }}
            >
              <span className="text-sm">{connection.name}</span>
              <Switch
                aria-label={`Use ${connection.name}`}
                checked={selected}
                onCheckedChange={() => {
                  toggleConnection(connection.id)
                }}
                onClick={(event) => {
                  event.stopPropagation()
                }}
              />
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
