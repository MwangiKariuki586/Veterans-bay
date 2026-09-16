"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type WorkspaceChromeValue = {
  contentReady: boolean;
  setContentReady: (ready: boolean) => void;
};

const WorkspaceChromeContext = createContext<WorkspaceChromeValue>({
  contentReady: true,
  setContentReady: () => undefined,
});

export function WorkspaceChromeProvider({ children }: { children: ReactNode }) {
  const [contentReady, setContentReadyState] = useState(true);
  const setContentReady = useCallback((ready: boolean) => {
    setContentReadyState(ready);
  }, []);
  const value = useMemo(
    () => ({ contentReady, setContentReady }),
    [contentReady, setContentReady],
  );

  return (
    <WorkspaceChromeContext.Provider value={value}>
      {children}
    </WorkspaceChromeContext.Provider>
  );
}

export function useWorkspaceChrome() {
  return useContext(WorkspaceChromeContext);
}

/** Hide the workspace footer while page content is still loading. */
export function useWorkspaceContentReady(ready: boolean) {
  const { setContentReady } = useWorkspaceChrome();

  useEffect(() => {
    setContentReady(ready);
    return () => setContentReady(true);
  }, [ready, setContentReady]);
}
