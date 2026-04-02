import type { FeatureSnapshot, FeatureStore } from "./FeatureStore";

export interface Operation {
  do(store: FeatureStore): void;
  undo(store: FeatureStore): void;
  getChangedIds(): string[];
}

function changedUnion(before: FeatureSnapshot[], after: FeatureSnapshot[]) {
  return Array.from(
    new Set([
      ...before.map((s) => s.id),
      ...after.map((s) => s.id),
    ])
  );
}

/**
 * 通用的“替换”：把 beforeIds 对应的图斑移除，并加入 afterFeatures。
 * after/before 都以 snapshot 形式存储，undo/redo 可稳定复原。
 */
export class ReplaceFeaturesOperation implements Operation {
  private beforeSnapshots: FeatureSnapshot[];
  private afterSnapshots: FeatureSnapshot[];

  constructor(args: { beforeSnapshots: FeatureSnapshot[]; afterSnapshots: FeatureSnapshot[] }) {
    this.beforeSnapshots = args.beforeSnapshots;
    this.afterSnapshots = args.afterSnapshots;
  }

  do(store: FeatureStore) {
    const beforeIds = this.beforeSnapshots.map((s) => s.id);
    const afterIds = this.afterSnapshots.map((s) => s.id);
    // 清理掉可能已经存在的 after（比如 modify 这类会先改完同 id 的场景）
    store.removeFeaturesByIds(afterIds);
    store.removeFeaturesByIds(beforeIds);

    const afterFeatures = this.afterSnapshots.map((s) =>
      store.featureFromSnapshot(s)
    );
    store.addFeatures(afterFeatures);
  }

  undo(store: FeatureStore) {
    const afterIds = this.afterSnapshots.map((s) => s.id);

    store.removeFeaturesByIds(afterIds);
    const beforeFeatures = this.beforeSnapshots.map((s) =>
      store.featureFromSnapshot(s)
    );
    store.addFeatures(beforeFeatures);
  }

  getChangedIds() {
    return changedUnion(this.beforeSnapshots, this.afterSnapshots);
  }
}

/**
 * “删除”就是把 afterSnapshots 置空的 ReplaceOperation
 */
export class DeleteFeaturesOperation implements Operation {
  private beforeSnapshots: FeatureSnapshot[];

  constructor(args: { beforeSnapshots: FeatureSnapshot[] }) {
    this.beforeSnapshots = args.beforeSnapshots;
  }

  do(store: FeatureStore) {
    const beforeIds = this.beforeSnapshots.map((s) => s.id);
    store.removeFeaturesByIds(beforeIds);
  }

  undo(store: FeatureStore) {
    const beforeFeatures = this.beforeSnapshots.map((s) =>
      store.featureFromSnapshot(s)
    );
    store.addFeatures(beforeFeatures);
  }

  getChangedIds() {
    return this.beforeSnapshots.map((s) => s.id);
  }
}

/**
 * “新增/创建”就是把 beforeSnapshots 置空的 ReplaceOperation
 */
export class CreateFeaturesOperation implements Operation {
  private afterSnapshots: FeatureSnapshot[];

  constructor(args: { afterSnapshots: FeatureSnapshot[] }) {
    this.afterSnapshots = args.afterSnapshots;
  }

  do(store: FeatureStore) {
    const afterFeatures = this.afterSnapshots.map((s) =>
      store.featureFromSnapshot(s)
    );
    store.addFeatures(afterFeatures);
  }

  undo(store: FeatureStore) {
    const afterIds = this.afterSnapshots.map((s) => s.id);
    store.removeFeaturesByIds(afterIds);
  }

  getChangedIds() {
    return this.afterSnapshots.map((s) => s.id);
  }
}


