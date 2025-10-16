# Add the ability to delete past chats

## Feature Description

In the side panel, a list of previous chats is displayed. Each chat entry includes a delete button (represented by a trash can icon) next to it. When the user clicks the delete button, a confirmation dialog appears asking, "Are you sure you want to delete this chat?" with "Cancel" and "Delete" options. If the user confirms the deletion, the selected chat is removed from the list and any associated data is deleted from the local storage. If the user cancels, no action is taken and the dialog closes.

## Implementation Details

- The chats are stored in local storage, just remove them from there.
- Use shadcn/lucide for the UI. The button should be visible only on hover.
