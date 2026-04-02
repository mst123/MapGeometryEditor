import GeoJSON from "ol/format/GeoJSON";
import VectorSource from "ol/source/Vector";
import type Feature from "ol/Feature";

import { ensureFeatureId } from "./id";

export type FeatureSnapshot = {
  id: string;
  geojson: any; // GeoJSON feature object
};

export class FeatureStore {
  private source: VectorSource;
  private geojson: GeoJSON;
  private byId = new Map<string, Feature>();

  constructor(opts: { source: VectorSource; geojson: GeoJSON }) {
    this.source = opts.source;
    this.geojson = opts.geojson;
  }

  getVectorSource() {
    return this.source;
  }

  getGeoJSONFormatter() {
    return this.geojson;
  }

  getById(id: string) {
    return this.byId.get(id) ?? null;
  }

  listAllIds() {
    return Array.from(this.byId.keys());
  }

  getSelectedFeatures(ids: string[]) {
    return ids.map((id) => this.byId.get(id)).filter(Boolean) as Feature[];
  }

  /**
   * 从 OL Feature 中提取 snapshot（用于 undo/redo）
   */
  snapshotOf(feature: Feature): FeatureSnapshot {
    const id = ensureFeatureId(feature);
    const geojson = this.geojson.writeFeatureObject(feature);
    return { id, geojson };
  }

  featureFromSnapshot(s: FeatureSnapshot): Feature {
    const features = this.geojson.readFeatures(s.geojson);
    const f = features[0];
    if (!f) {
      throw new Error(`快照无法还原 Feature(id=${s.id})`);
    }
    // 保底：快照里可能没有写入 id 字段，强制补齐
    ensureFeatureId(f);
    // 保持快照 id 一致
    f.set("id", s.id);
    return f;
  }

  addFeatures(features: Feature[]) {
    for (const f of features) {
      const id = ensureFeatureId(f);
      this.byId.set(id, f);
      this.source.addFeature(f);
    }
    this.source.changed();
  }

  removeFeaturesByIds(ids: string[]) {
    for (const id of ids) {
      const f = this.byId.get(id);
      if (!f) continue;
      this.source.removeFeature(f);
      this.byId.delete(id);
    }
    this.source.changed();
  }

  replaceBySnapshots(beforeIds: string[], afterFeatures: Feature[]) {
    // beforeIds: 需要被移除的集合
    this.removeFeaturesByIds(beforeIds);
    this.addFeatures(afterFeatures);
  }
}

