"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { api } from "./client";
export function useResource<T>(path: string, schema: z.ZodType<T>) {
  const [state, setState] = useState<{
    path: string;
    schema: z.ZodType<T>;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ path, schema, data: null, error: "", loading: true });
  const lifecycle = useRef({ version: 0, mounted: false });
  const load = useCallback(async () => {
    const version = ++lifecycle.current.version;
    setState((previous) => ({
      path,
      schema,
      data:
        previous.path === path && previous.schema === schema
          ? previous.data
          : null,
      error: "",
      loading: true,
    }));
    try {
      const data = await api(path, schema);
      if (lifecycle.current.mounted && version === lifecycle.current.version)
        setState({ path, schema, data, error: "", loading: false });
    } catch (e) {
      if (lifecycle.current.mounted && version === lifecycle.current.version)
        setState((previous) => ({
          ...previous,
          error: e instanceof Error ? e.message : "Unable to load data.",
          loading: false,
        }));
    }
  }, [path, schema]);
  useEffect(() => {
    const current = lifecycle.current;
    current.mounted = true;
    void load();
    return () => {
      current.mounted = false;
      ++current.version;
    };
  }, [load]);
  const current = state.path === path && state.schema === schema;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: current ? state.loading : true,
    reload: load,
  };
}
