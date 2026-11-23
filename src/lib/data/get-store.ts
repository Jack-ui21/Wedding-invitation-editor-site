import { assertProductionConfig, DATA_DRIVER } from "../config";
import { localStore } from "./local";
import type { DataStore } from "./store";
import { supabaseStore } from "./supabase";

let store: DataStore | null = null;

export function getStore(): DataStore {
  if (!store) {
    assertProductionConfig();
    store = DATA_DRIVER === "supabase" ? supabaseStore : localStore;
  }
  return store;
}
