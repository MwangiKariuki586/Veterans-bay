"use client";

import { createContext, useContext } from "react";

type WorkspaceShellContextValue = {
  workspaceLabel: string;
  workspaceId: string | null;
  userId: string | null;
};

export const WorkspaceShellContext = createContext<WorkspaceShellContextValue>({
  workspaceLabel: "Workspace",
  workspaceId: null,
  userId: null,
});

export function useWorkspaceShell() {
  return useContext(WorkspaceShellContext);
}
