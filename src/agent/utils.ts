import { randomUUID } from "node:crypto";

export function generateTaskId(): string {
    return randomUUID();
}
