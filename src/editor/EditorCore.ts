import type Map from "ol/Map";
import Draw from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import Collection from "ol/Collection";
import type Feature from "ol/Feature";
import { message } from "./message";
import type { FeatureStore } from "./FeatureStore";
import type { Operation } from "./operations";
import {
  ReplaceFeaturesOperation,
  DeleteFeaturesOperation,
  CreateFeaturesOperation,
} from "./operations";
import { HistoryController } from "./History";
import type { FeatureSnapshot } from "./FeatureStore";
import {
  assignDerivedFeatureMeta,
  assignNewFeatureMeta,
} from "./id";
import {
  polygonCut,
  mergePolygons,
  maskPolygon,
  commonLineAdd,
} from "./geometryService";
import type VectorSource from "ol/source/Vector";
import * as turf from "@turf/turf";

export type ToolId =
  | "ADD_NEW"
  | "COMMON_LINE_ADD"
  | "EDIT_NODES"
  | "FEATURE_TRANSFER"
  | "SPLIT"
  | "MERGE"
  | "MASK"
  | "BREAK_UP"
  | "PLASTIC"
  | "DELETE";

export class EditorCore {
  private map: any;
  private store: FeatureStore;
  private history: HistoryController;
  private draftSource: VectorSource;

  private activeTool: ToolId | null = null;
  private interactions: any[] = [];

  private selectedIds: string[] = [];

  constructor(opts: {
    map: Map;
    store: FeatureStore;
    draftSource: VectorSource;
    history: HistoryController;
  }) {
    this.map = opts.map;
    this.store = opts.store;
    this.draftSource = opts.draftSource;
    this.history = opts.history;

    this._bindSelection();
  }

  getSelectedIds() {
    return [...this.selectedIds];
  }

  private clearInteractions() {
    this.interactions.forEach((it) => this.map.removeInteraction(it));
    this.interactions = [];
  }

  private clearDraft() {
    this.draftSource.clear();
  }

  private setSelectedFeatures(features: Feature[]) {
    // 先清空旧状态
    for (const id of this.selectedIds) {
      const old = this.store.getById(id);
      if (old) old.set("_selected", false);
    }

    this.selectedIds = features
      .map((f) => f && this.store.snapshotOf(f).id)
      .filter(Boolean);

    features.forEach((f) => {
      f.set("_selected", true);
    });
    this.store.getVectorSource().changed();
  }

  private _bindSelection() {
    this.map.on("singleclick", (e: any) => {
      if (this.activeTool) return;

      const feats = this.map
        .getFeaturesAtPixel(e.pixel)
        ?.filter((f: Feature) => f && f.get("_isBase") !== false) ?? [];

      const picked = feats.filter((f: Feature) => {
        // 只选出 store 里管理的要素（避免选中草稿层）
        const id = f.get("id");
        return typeof id === "string" && !!this.store.getById(id);
      });

      if (picked.length === 0) {
        this.setSelectedFeatures([]);
        return;
      }

      // 简化规则：shift 多选，普通点击单选
      if (e.originalEvent?.shiftKey) {
        const next: Feature[] = [];
        const set = new Set(this.selectedIds);
        for (const f of picked) {
          const id = this.store.snapshotOf(f).id;
          if (set.has(id)) {
            // toggle off
            continue;
          }
          next.push(f);
          set.add(id);
        }
        // 同步当前仍选中的部分
        const keep = this.selectedIds
          .filter((id) => {
            const f = this.store.getById(id);
            return f && f.get("_selected");
          })
          .map((id) => this.store.getById(id))
          .filter(Boolean) as Feature[];
        this.setSelectedFeatures([...keep, ...next]);
      } else {
        this.setSelectedFeatures(picked);
      }
    });
  }

  private apply(op: Operation) {
    this.history.apply(op, this.store);
  }

  undo() {
    if (this.history.undo(this.store)) {
      // undo 后 selection 不强制同步，保持当前 selection
    }
  }

  redo() {
    if (this.history.redo(this.store)) {
      // 同上
    }
  }

  startAddNew() {
    this.stop();
    this.activeTool = "ADD_NEW";

    const draw = new Draw({
      type: "Polygon",
      source: this.draftSource,
    });

    this._pushInteraction(draw);
    this.map.addInteraction(draw);

    draw.once("drawend", (evt: any) => {
      try {
        const newFeature: Feature = evt.feature;
        assignNewFeatureMeta(newFeature);

        const afterSnapshot = this.store.snapshotOf(newFeature);
        const op = new CreateFeaturesOperation({
          afterSnapshots: [afterSnapshot],
        });
        this.apply(op);
        this.setSelectedFeatures([this.store.getById(afterSnapshot.id)!].filter(Boolean));
      } finally {
        this.clearDraft();
        this.stop();
      }
    });
  }

  startCommonLineAdd() {
    if (this.selectedIds.length === 0) {
      message.error("当前并未选择图斑，请至少选择一个图斑！");
      return;
    }
    this.stop();
    this.activeTool = "COMMON_LINE_ADD";

    const parents = this.selectedIds
      .map((id) => this.store.getById(id))
      .filter(Boolean) as Feature[];

    const draw = new Draw({
      type: "Polygon",
      source: this.draftSource,
    });
    this._pushInteraction(draw);
    this.map.addInteraction(draw);

    draw.once("drawend", (evt: any) => {
      try {
        const drawPolygonGeo = this.store
          .getGeoJSONFormatter()
          .writeFeatureObject(evt.feature);
        const parentPolysGeo = parents.map((f) =>
          this.store.getGeoJSONFormatter().writeFeatureObject(f)
        );

        const handled = commonLineAdd(parentPolysGeo, drawPolygonGeo);
        if (!handled) {
          message.warning("共边画面未产生结果");
          return;
        }

        const handledFeature = this.store
          .getGeoJSONFormatter()
          .readFeature(handled);
        if (!handledFeature) return;

        assignDerivedFeatureMeta(parents, [handledFeature]);
        const afterSnap = this.store.snapshotOf(handledFeature);

        const op = new CreateFeaturesOperation({
          afterSnapshots: [afterSnap],
        });
        this.apply(op);
        this.setSelectedFeatures([
          this.store.getById(afterSnap.id)!,
        ].filter(Boolean));
      } finally {
        this.clearDraft();
        this.stop();
      }
    });
  }

  startEditNodes() {
    if (this.selectedIds.length !== 1) {
      message.warning("请选中一个图斑进行编辑");
      return;
    }
    this.stop();
    this.activeTool = "EDIT_NODES";

    const selectedId = this.selectedIds[0]!;
    const feature = this.store.getById(selectedId);
    if (!feature) return;

    let before: FeatureSnapshot | null = null;

    const modify = new Modify({
      features: new Collection([feature]),
      pixelTolerance: 20,
      insertVertexCondition: () => true,
      deleteCondition: (e: any) => e.type === "singleclick",
    });

    this._pushInteraction(modify);
    this.map.addInteraction(modify);

    modify.on("modifystart", () => {
      before = this.store.snapshotOf(feature);
    });
    modify.once("modifyend", () => {
      try {
        if (!before) return;
        const after = this.store.snapshotOf(feature);
        const op = new ReplaceFeaturesOperation({
          beforeSnapshots: [before],
          afterSnapshots: [after],
        });
        this.apply(op);
        this.setSelectedFeatures([this.store.getById(after.id)!].filter(Boolean));
      } finally {
        this.stop();
      }
    });
  }

  startFeatureTransfer() {
    if (this.selectedIds.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    this.stop();
    this.activeTool = "FEATURE_TRANSFER";

    const parentId = this.selectedIds[0]!;
    const parent = this.store.getById(parentId);
    if (!parent) return;

    const draw = new Draw({
      type: "Polygon",
      source: this.draftSource,
    });
    this._pushInteraction(draw);
    this.map.addInteraction(draw);

    draw.once("drawend", (evt: any) => {
      try {
        const newFeature = evt.feature as Feature;
        assignDerivedFeatureMeta([parent], [newFeature]);

        const beforeSnap = this.store.snapshotOf(parent);
        const afterSnap = this.store.snapshotOf(newFeature);

        const op = new ReplaceFeaturesOperation({
          beforeSnapshots: [beforeSnap],
          afterSnapshots: [afterSnap],
        });
        this.apply(op);
        this.setSelectedFeatures([this.store.getById(afterSnap.id)!].filter(Boolean));
      } finally {
        this.clearDraft();
        this.stop();
      }
    });
  }

  startSplit() {
    if (this.selectedIds.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    this.stop();
    this.activeTool = "SPLIT";

    const parentId = this.selectedIds[0]!;
    const parent = this.store.getById(parentId);
    if (!parent) return;

    const parentGeo = this.store.getGeoJSONFormatter().writeFeatureObject(parent);

    const draw = new Draw({
      type: "LineString",
      source: this.draftSource,
    });
    this._pushInteraction(draw);
    this.map.addInteraction(draw);

    draw.once("drawend", (evt: any) => {
      try {
        const lineGeo = this.store
          .getGeoJSONFormatter()
          .writeFeatureObject(evt.feature);

        const cut = polygonCut(parentGeo, lineGeo);
        if (!cut) {
          message.error("切割失败");
          return;
        }

        const splitFeatures = this.store.getGeoJSONFormatter().readFeatures(cut);
        if (!splitFeatures.length) return;

        assignDerivedFeatureMeta([parent], splitFeatures);

        const beforeSnap = [this.store.snapshotOf(parent)];
        const afterSnaps = splitFeatures.map((f) => this.store.snapshotOf(f));

        const op = new ReplaceFeaturesOperation({
          beforeSnapshots: beforeSnap,
          afterSnapshots: afterSnaps,
        });
        this.apply(op);
        this.setSelectedFeatures(afterSnaps.map((s) => this.store.getById(s.id)).filter(Boolean) as Feature[]);
      } finally {
        this.clearDraft();
        this.stop();
      }
    });
  }

  startMerge() {
    if (this.selectedIds.length < 2) {
      message.error("请至少选择两个图形！");
      return;
    }
    this.stop();
    this.activeTool = "MERGE";

    const parents = this.selectedIds
      .map((id) => this.store.getById(id))
      .filter(Boolean) as Feature[];

    try {
      const parentGeos = parents.map((f) =>
        this.store.getGeoJSONFormatter().writeFeatureObject(f)
      );

      const mergedGeo = mergePolygons(parentGeos);
      const mergedFeature = this.store
        .getGeoJSONFormatter()
        .readFeature(mergedGeo);
      if (!mergedFeature) return;

      assignDerivedFeatureMeta(parents, [mergedFeature]);

      const beforeSnaps = parents.map((f) => this.store.snapshotOf(f));
      const afterSnap = this.store.snapshotOf(mergedFeature);

      const op = new ReplaceFeaturesOperation({
        beforeSnapshots: beforeSnaps,
        afterSnapshots: [afterSnap],
      });
      this.apply(op);
      this.setSelectedFeatures([this.store.getById(afterSnap.id)!].filter(Boolean));
    } finally {
      this.stop();
    }
  }

  startMask() {
    if (this.selectedIds.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    this.stop();
    this.activeTool = "MASK";

    const parentId = this.selectedIds[0]!;
    const parent = this.store.getById(parentId);
    if (!parent) return;

    const maskGeo = this.store.getGeoJSONFormatter().writeFeatureObject(parent);

    const draw = new Draw({
      type: "Polygon",
      source: this.draftSource,
    });
    this._pushInteraction(draw);
    this.map.addInteraction(draw);

    draw.once("drawend", (evt: any) => {
      try {
        const holeGeo = this.store.getGeoJSONFormatter().writeFeatureObject(evt.feature);
        const resultGeo = maskPolygon(maskGeo, holeGeo);
        const resultFeature = this.store
          .getGeoJSONFormatter()
          .readFeature(resultGeo);
        if (!resultFeature) return;

        assignDerivedFeatureMeta([parent], [resultFeature]);

        const beforeSnap = this.store.snapshotOf(parent);
        const afterSnap = this.store.snapshotOf(resultFeature);

        const op = new ReplaceFeaturesOperation({
          beforeSnapshots: [beforeSnap],
          afterSnapshots: [afterSnap],
        });
        this.apply(op);
        this.setSelectedFeatures([this.store.getById(afterSnap.id)!].filter(Boolean));
      } finally {
        this.clearDraft();
        this.stop();
      }
    });
  }

  startBreakUp() {
    if (this.selectedIds.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    this.stop();
    this.activeTool = "BREAK_UP";

    const parentId = this.selectedIds[0]!;
    const parent = this.store.getById(parentId);
    if (!parent) return;

    try {
      const geo = this.store.getGeoJSONFormatter().writeFeatureObject(parent);
      const fc = turf.unkinkPolygon(geo);
      if (!fc || !fc.features || fc.features.length < 2) {
        message.error("不需要打散");
        return;
      }

      const features = this.store.getGeoJSONFormatter().readFeatures(fc);
      assignDerivedFeatureMeta([parent], features);

      const beforeSnaps = [this.store.snapshotOf(parent)];
      const afterSnaps = features.map((f) => this.store.snapshotOf(f));

      const op = new ReplaceFeaturesOperation({
        beforeSnapshots: beforeSnaps,
        afterSnapshots: afterSnaps,
      });
      this.apply(op);
      this.setSelectedFeatures(afterSnaps.map((s) => this.store.getById(s.id)).filter(Boolean) as Feature[]);
    } finally {
      this.stop();
    }
  }

  startPlastic() {
    if (this.selectedIds.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    this.stop();
    this.activeTool = "PLASTIC";

    const parentId = this.selectedIds[0]!;
    const parent = this.store.getById(parentId);
    if (!parent) return;

    const parentGeo = this.store.getGeoJSONFormatter().writeFeatureObject(parent);

    const draw = new Draw({
      type: "LineString",
      source: this.draftSource,
    });
    this._pushInteraction(draw);
    this.map.addInteraction(draw);

    draw.once("drawend", (evt: any) => {
      try {
        const lineGeo = this.store.getGeoJSONFormatter().writeFeatureObject(evt.feature);
        const coords = lineGeo.geometry.coordinates;
        const start = coords[0];
        const end = coords[coords.length - 1];

        const startIn = turf.booleanPointInPolygon(start, parentGeo);
        const endIn = turf.booleanPointInPolygon(end, parentGeo);
        if (startIn && endIn) {
          const closed = [...coords, start];
          const commonLinePolygon = turf.lineToPolygon(turf.lineString(closed));
          const newUnion = turf.union(parentGeo, commonLinePolygon);
          const newFeature = this.store
            .getGeoJSONFormatter()
            .readFeature(newUnion);
          if (!newFeature) return;
          assignDerivedFeatureMeta([parent], [newFeature]);
          const beforeSnap = this.store.snapshotOf(parent);
          const afterSnap = this.store.snapshotOf(newFeature);
          const op = new ReplaceFeaturesOperation({
            beforeSnapshots: [beforeSnap],
            afterSnapshots: [afterSnap],
          });
          this.apply(op);
          const afterFeature = this.store.getById(afterSnap.id);
          if (afterFeature) this.setSelectedFeatures([afterFeature]);
        } else if (!startIn && !endIn) {
          // 只做简单切割并保留面积较大的那一片（兼容你旧逻辑）
          const cut = polygonCut(parentGeo, lineGeo);
          if (!cut || !cut.features || cut.features.length < 2) {
            message.error("切割失败");
            return;
          }
          const pieces = this.store.getGeoJSONFormatter().readFeatures(cut).slice(0, 2);
          if (pieces.length < 2) {
            message.error("切割结果不足");
            return;
          }
          const piece0 = pieces[0]!;
          const piece1 = pieces[1]!;
          // 使用 turf.area 选大块
          const area0 = turf.area(this.store.getGeoJSONFormatter().writeFeatureObject(piece0));
          const area1 = turf.area(this.store.getGeoJSONFormatter().writeFeatureObject(piece1));
          const pickedCopy = area1 > area0 ? piece1 : piece0;
          assignDerivedFeatureMeta([parent], [pickedCopy]);
          const beforeSnap = this.store.snapshotOf(parent);
          const afterSnap = this.store.snapshotOf(pickedCopy);
          const op = new ReplaceFeaturesOperation({
            beforeSnapshots: [beforeSnap],
            afterSnapshots: [afterSnap],
          });
          this.apply(op);
          const afterFeature = this.store.getById(afterSnap.id);
          if (afterFeature) this.setSelectedFeatures([afterFeature]);
        } else {
          message.error("请确认起点、终点位置");
          return;
        }
      } finally {
        this.clearDraft();
        this.stop();
      }
    });
  }

  deleteSelection() {
    if (this.selectedIds.length === 0) return;
    const beforeSnaps = this.selectedIds
      .map((id) => this.store.getById(id))
      .filter(Boolean)
      .map((f) => this.store.snapshotOf(f as Feature));

    const op = new DeleteFeaturesOperation({ beforeSnapshots: beforeSnaps });
    this.apply(op);
    this.setSelectedFeatures([]);
  }

  stop() {
    this.clearInteractions();
    this.clearDraft();
    this.activeTool = null;
  }

  private _pushInteraction(it: any) {
    this.interactions.push(it);
  }
}

