import type { Operation } from "./operations";
import type { FeatureStore } from "./FeatureStore";

export class HistoryController {
  private undoStack: Operation[] = [];
  private redoStack: Operation[] = [];

  apply(op: Operation, store: FeatureStore) {
    op.do(store);
    this.undoStack.push(op);
    this.redoStack = [];
  }

  undo(store: FeatureStore) {
    const op = this.undoStack.pop();
    if (!op) return false;
    op.undo(store);
    this.redoStack.push(op);
    return true;
  }

  redo(store: FeatureStore) {
    const op = this.redoStack.pop();
    if (!op) return false;
    op.do(store);
    this.undoStack.push(op);
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}

