// In-memory storage for this MVP
export interface IStorage {
  // No storage methods needed for this stateless MVP
  // But we keep the interface for structure
}

export class MemStorage implements IStorage {
  constructor() {
    // No initialization needed
  }
}

export const storage = new MemStorage();
