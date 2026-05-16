import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { useCommands } from "./command-registry";

export interface ApiCallEntry {
  url: string;
  method: string;
  status: number;
  latencyMs: number;
  timestamp: string;
}

export interface NavEntry {
  pathname: string;
  timestamp: string;
}

export interface ErrorEntry {
  message: string;
  stack?: string;
  timestamp: string;
}

export interface TelemetrySnapshot {
  errors: ErrorEntry[];
  apiCalls: ApiCallEntry[];
  navigation: NavEntry[];
  commands: string[];
}

interface TelemetryContextValue {
  getSnapshot: () => TelemetrySnapshot;
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

function addToRingBuffer<T>(buf: T[], item: T, maxSize: number): T[] {
  const next = [...buf, item];
  return next.length > maxSize ? next.slice(next.length - maxSize) : next;
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const errorsRef = useRef<ErrorEntry[]>([]);
  const apiCallsRef = useRef<ApiCallEntry[]>([]);
  const navigationRef = useRef<NavEntry[]>([]);
  const commandsRef = useRef<string[]>([]);

  const router = useRouter();
  const { subscribeToExecutions } = useCommands();

  // Fetch interceptor for /api/ calls
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function interceptedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      const start = Date.now();

      const response = await originalFetch(input, init);

      if (url.includes("/api/")) {
        const entry: ApiCallEntry = {
          url,
          method,
          status: response.status,
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
        apiCallsRef.current = addToRingBuffer(apiCallsRef.current, entry, 10);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // JS error capture
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      const entry: ErrorEntry = {
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
      };
      errorsRef.current = addToRingBuffer(errorsRef.current, entry, 5);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const entry: ErrorEntry = {
        message: String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
      };
      errorsRef.current = addToRingBuffer(errorsRef.current, entry, 5);
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  // TanStack Router navigation subscription
  useEffect(() => {
    const unsubscribe = router.subscribe("onLoad", ({ toLocation }) => {
      const entry: NavEntry = {
        pathname: toLocation.pathname,
        timestamp: new Date().toISOString(),
      };
      navigationRef.current = addToRingBuffer(navigationRef.current, entry, 5);
    });

    return unsubscribe;
  }, [router]);

  // Command execution subscription
  useEffect(() => {
    const unsubscribe = subscribeToExecutions((commandId: string) => {
      commandsRef.current = addToRingBuffer(commandsRef.current, commandId, 20);
    });

    return unsubscribe;
  }, [subscribeToExecutions]);

  const getSnapshot = useCallback((): TelemetrySnapshot => ({
    errors: [...errorsRef.current],
    apiCalls: [...apiCallsRef.current],
    navigation: [...navigationRef.current],
    commands: [...commandsRef.current],
  }), []);

  return (
    <TelemetryContext.Provider value={{ getSnapshot }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}
