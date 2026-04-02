import { GeoJSON } from "ol/format";

/**
 * 图斑变化检测器
 * 使用哈希算法比较图斑的 geometry 和 properties 是否发生变化
 */
class FeatureChangeDetector {
  constructor() {
    // 存储初始状态的快照，key 为 feature 的唯一标识（如 QDNM 或 id）
    this.originalSnapshots = new Map();
  }

  /**
   * 初始化图斑数据，保存原始快照
   * @param {Array<Feature>} features - OpenLayers Feature 数组
   * @param {string} idKey - 用于标识 feature 的唯一属性名，默认 'id'
   * @param {Array<string>} propertiesToWatch - 需要监听的属性列表，为空则监听所有属性
   */
  initFeatures(features, idKey = 'id', propertiesToWatch = []) {
    const geoJSON = new GeoJSON();
    
    features.forEach(feature => {
      const featureData = JSON.parse(geoJSON.writeFeature(feature));
      const featureId = feature.get(idKey) || feature.getId();
      
      if (!featureId) {
        console.warn('Feature 缺少唯一标识，跳过初始化');
        return;
      }

      // 提取需要比较的属性
      const properties = this._extractProperties(
        featureData.properties, 
        propertiesToWatch
      );

      // 保存原始快照
      this.originalSnapshots.set(featureId, {
        geometry: featureData.geometry.coordinates,
        properties: properties,
        hash: this._generateHash(featureData.geometry.coordinates, properties)
      });
    });
  }

  /**
   * 判断单个图斑是否发生变化
   * @param {Feature} feature - OpenLayers Feature
   * @param {string} idKey - feature 的唯一标识属性名
   * @param {Array<string>} propertiesToWatch - 需要监听的属性列表
   * @returns {Object} { changed: boolean, changes: { geometry: boolean, properties: boolean }, isNew: boolean }
   */
  isFeatureChanged(feature, idKey = 'id', propertiesToWatch = []) {
    const geoJSON = new GeoJSON();
    const featureData = JSON.parse(geoJSON.writeFeature(feature));
    const featureId = feature.get(idKey) || feature.getId();

    if (!featureId) {
      return { changed: false, error: 'Feature 缺少唯一标识' };
    }

    const original = this.originalSnapshots.get(featureId);
    
    // 新图斑（不在原始快照中）
    if (!original) {
      return { changed: true, isNew: true, changes: { geometry: true, properties: true } };
    }

    // 提取当前属性
    const currentProperties = this._extractProperties(
      featureData.properties,
      propertiesToWatch
    );

    // 比较 geometry
    const geometryChanged = !this._compareCoordinates(
      original.geometry,
      featureData.geometry.coordinates
    );

    // 比较 properties
    const propertiesChanged = !this._deepEqual(
      original.properties,
      currentProperties
    );

    const changed = geometryChanged || propertiesChanged;

    return {
      changed,
      isNew: false,
      changes: {
        geometry: geometryChanged,
        properties: propertiesChanged
      }
    };
  }

  /**
   * 批量检查多个图斑的变化
   * @param {Array<Feature>} features - OpenLayers Feature 数组
   * @param {string} idKey - feature 的唯一标识属性名
   * @param {Array<string>} propertiesToWatch - 需要监听的属性列表
   * @returns {Map} Map<featureId, changeResult>
   */
  checkMultipleFeatures(features, idKey = 'id', propertiesToWatch = []) {
    const results = new Map();
    
    features.forEach(feature => {
      const featureId = feature.get(idKey) || feature.getId();
      if (featureId) {
        results.set(featureId, this.isFeatureChanged(feature, idKey, propertiesToWatch));
      }
    });

    return results;
  }

  /**
   * 更新某个图斑的原始快照（保存后调用）
   * @param {Feature} feature - OpenLayers Feature
   * @param {string} idKey - feature 的唯一标识属性名
   * @param {Array<string>} propertiesToWatch - 需要监听的属性列表
   */
  updateSnapshot(feature, idKey = 'id', propertiesToWatch = []) {
    const geoJSON = new GeoJSON();
    const featureData = JSON.parse(geoJSON.writeFeature(feature));
    const featureId = feature.get(idKey) || feature.getId();

    if (!featureId) {
      console.warn('Feature 缺少唯一标识，无法更新快照');
      return;
    }

    const properties = this._extractProperties(
      featureData.properties,
      propertiesToWatch
    );

    this.originalSnapshots.set(featureId, {
      geometry: featureData.geometry.coordinates,
      properties: properties,
      hash: this._generateHash(featureData.geometry.coordinates, properties)
    });
  }

  /**
   * 移除某个图斑的快照
   * @param {string} featureId - feature 的唯一标识
   */
  removeSnapshot(featureId) {
    this.originalSnapshots.delete(featureId);
  }

  /**
   * 清空所有快照
   */
  clear() {
    this.originalSnapshots.clear();
  }

  /**
   * 获取所有已初始化的 feature ID 列表
   * @returns {Array<string>}
   */
  getSnapshotIds() {
    return Array.from(this.originalSnapshots.keys());
  }

  /**
   * 获取某个图斑的原始快照
   * @param {string} featureId - feature 的唯一标识
   * @returns {Object|null}
   */
  getSnapshot(featureId) {
    return this.originalSnapshots.get(featureId) || null;
  }

  // ========== 私有方法 ==========

  /**
   * 提取需要比较的属性
   * @private
   */
  _extractProperties(properties, propertiesToWatch) {
    if (propertiesToWatch.length === 0) {
      // 如果没有指定，返回所有属性（排除内部属性）
      const filtered = { ...properties };
      // 排除 OpenLayers 内部属性
      delete filtered._status;
      delete filtered._toBeSave;
      delete filtered._changed;
      return filtered;
    }

    const extracted = {};
    propertiesToWatch.forEach(key => {
      extracted[key] = key in properties ? properties[key] : "";
    });
    return extracted;
  }

  /**
   * 生成哈希值（使用简单的字符串哈希算法）
   * @private
   */
  _generateHash(geometry, properties) {
    const data = JSON.stringify({ geometry, properties });
    return this._simpleHash(data);
  }

  /**
   * 简单的字符串哈希函数（djb2 算法变体）
   * @private
   */
  _simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // 转换为 32 位整数
    }
    return hash.toString(36); // 转换为 36 进制字符串
  }

  /**
   * 比较坐标数组是否相等
   * @private
   */
  _compareCoordinates(coord1, coord2) {
    return JSON.stringify(coord1) === JSON.stringify(coord2);
  }

  /**
   * 深度比较两个对象是否相等
   * @private
   */
  _deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }
}

export default FeatureChangeDetector;

