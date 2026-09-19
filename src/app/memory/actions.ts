"use server";

import { revalidatePath } from "next/cache";
import {
  deleteMemory,
  clearAllMemory,
} from "@/application/memory/memory-service";

export async function deleteMemoryAction(id: string): Promise<void> {
  deleteMemory(id);
  revalidatePath("/memory");
  revalidatePath("/");
}

export async function clearAllMemoryAction(): Promise<void> {
  clearAllMemory();
  revalidatePath("/memory");
  revalidatePath("/");
}
