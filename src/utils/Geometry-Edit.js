import { Modify, Select, Draw, Snap } from "ol/interaction";
import { Vector as VectorSource } from "ol/source";
import { GeoJSON } from "ol/format";
import Point from "ol/geom/Point";
import Collection from "ol/Collection";
import Feature from "ol/Feature";

import * as turf from "@turf/turf";
import { ref } from "vue";
import { createVectorLayer } from "./map-method";
import { RENDER_LAYER, EDIT_LAYER } from "../const/symbol";
import { MAP_TOOL } from "../const";
import { renderLayerStyle, editLayerStyle } from "./layer-style";
import { message } from "./message.js";
// 简单处理，弱化业务属性
// 每个功能必须关闭后 在使用其他功能

class GeometryEdit {
  constructor(map, options = {}) {
    this.map = map;
    window.map = map;
    // 操作时 所使用主要图层
    this.renderLayer = this._createRenderLayer();
    this.renderLayerSource = this.renderLayer.getSource();
    this.map.addLayer(this.renderLayer);

    // 编辑时使用的图层 副图层
    this.editLayer = this._createEditLayer();
    this.editLayerSource = this.editLayer.getSource();
    this.map.addLayer(this.editLayer);
    // 目前在运行的交互
    this.interactionList = [];
    // 目前在运行的功能
    this.activeTool = options.activeToolRef || ref(null);
    // 当前选中的图斑
    this.selectedFeature = [];
    // 显示弹窗的回调函数 处理重叠图斑选择
    this.showFeatureDialog = options.showFeatureDialog || null;
    // 当前重叠的图斑（用于弹窗选择）
    this.overlappingFeatures = [];

    // 历史记录
    this.undoStack = [];
    this.stackIndex = -1;
    
    this._init();
  }

  _init() {
    // 开启图斑选择功能
    this._addSelectInteraction();
  }

  // 新增
  addNew() {
    if (!this._checkActiveTool(MAP_TOOL.ADD_NEW)) return;

    // 需要关闭此功能
    if (this.activeTool.value === MAP_TOOL.ADD_NEW) {
      this._clearInteractions();
      this.activeTool.value = null;
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.ADD_NEW;
    const draw = new Draw({
      type: "Polygon",
      source: this.renderLayerSource,
    });

    this.interactionList.push(draw);
    this.map.addInteraction(draw);
  }
  // TODO 禁止切换其他功能 和 关闭 当前功能可以合并到一个函数中
  commonLineAdd() {
    if (!this._checkActiveTool(MAP_TOOL.COMMON_LINE_ADD_NEW)) return;

    // 关闭
    if (this.activeTool.value === MAP_TOOL.COMMON_LINE_ADD_NEW) {
      this._clearInteractions();
      this.activeTool.value = null;
      return;
    }
    if (this.selectedFeature.length === 0) {
      message.error("当前并未选择图斑，请至少选择一个图斑！");
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.COMMON_LINE_ADD_NEW;
    const features = this.selectedFeature.map((item) =>
      new GeoJSON().writeFeatureObject(item)
    );

    const draw = new Draw({
      source: this.renderLayerSource,
      type: "Polygon",
    });
    this.map.addInteraction(draw);
    this.interactionList.push(draw);

    draw.on("drawend", (evt) => {
      const drawFeatureGeoJSON = new GeoJSON().writeFeatureObject(evt.feature);

      const filterPart = [];
      features.forEach((item) => {
        if (
          item.geometry.type === "Polygon" ||
          item.geometry.type === "MultiPolygon"
        ) {
          const different = turf.difference(item, drawFeatureGeoJSON);
          // 存在共同区域
          if (!turf.booleanEqual(different, item)) {
            filterPart.push(
              turf.buffer(item, 0.0001, {
                units: "kilometers",
              })
            );
          }
        }
      });
      if (filterPart.length) {
        const handledFeature = new GeoJSON().readFeatures(
          turf.difference(drawFeatureGeoJSON, turf.union(...filterPart))
        )[0];

        this.renderLayerSource.addFeature(handledFeature);
        this._clearDrawEffect(evt.feature);
      }
    });
  }

  // 编辑
  edit() {
    if (!this._checkActiveTool(MAP_TOOL.EDIT)) return;
    // 检查是否选中图斑 有且仅有一个
    if (this.selectedFeature.length !== 1) {
      message.warning("请选中一个图斑进行编辑");
      return;
    }
    // 关闭
    if (this.activeTool.value === MAP_TOOL.EDIT) {
      this._clearInteractions();
      this.editLayerSource.clear();
      this.activeTool.value = null;
      return;
    }
    // 开启
    this.activeTool.value = MAP_TOOL.EDIT;
    this._syncEditLayer();

    const modify = new Modify({
      features: new Collection(this.selectedFeature),
      pixelTolerance: 20,
      insertVertexCondition: (event) => {
        return true;
      },
      deleteCondition: (e) => {
        if (e.type === "singleclick") {
          return true;
        }
      },
    });
    this.map.addInteraction(modify);
    this.interactionList.push(modify);
    // TODO 历史记录
    // modify.on("modifystart", evt => {
    // });
    modify.on("modifyend", (evt) => {
      this._syncEditLayer();
      // this.recordHistory(
      //   {
      //     add: [new GeoJSON().writeFeature(evt.features.getArray()[0])],
      //     remove: removeFeaGeoArr
      //   }
      // );
    });
  }

  featureTransfer(options = {}) {
    if (!this._checkActiveTool(MAP_TOOL.FEATURE_TRANSFER)) return;
    const { snap = false, normalComplete = false } = options;
    // 关闭
    if (this.activeTool.value === MAP_TOOL.FEATURE_TRANSFER) {
      // 程序正常关闭
      if (normalComplete) {
        this._clearInteractions();
        this.activeTool.value = null;
        return;
      } else {
        // TODO 中途取消 考虑用历史记录 回退
        
      }
    }
    if (this.selectedFeature.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.FEATURE_TRANSFER;
    // TODO 显示图斑的节点 方便修改 边界加虚线，可能会更好
    const points = turf.explode(
      new GeoJSON().writeFeatureObject(this.selectedFeature[0])
    );
    this.editLayer.setZIndex(999);

    // 是否开启吸附
    
    if (snap) {
      // 监听 addfeatures 事件，确保 features 添加完成后再创建 Snap
      const handleAddFeatures = () => {
        // 添加吸附 方便操作
        const snap = new Snap({
          source: this.editLayerSource,
        });
        this.map.addInteraction(snap);
        this.interactionList.push(snap);
      };
      this.editLayer.once("postrender", handleAddFeatures);
    }

    this.editLayerSource.addFeatures(new GeoJSON().readFeatures(points));

    // 删除原图形
    this.renderLayerSource.removeFeature(this.selectedFeature[0]);

    // 开启编辑功能
    const draw = new Draw({
      source: this.renderLayerSource,
      type: "Polygon",
    });
    draw.on("drawend", (evt) => {
      this.selectedFeature = [evt.feature];
      this.editLayerSource.clear();
      // 关闭功能
      this.featureTransfer({ normalComplete: true });
    });
    this.map.addInteraction(draw);
    this.interactionList.push(draw);
  }

  // 拆分
  split() {
    if (!this._checkActiveTool(MAP_TOOL.SPLIT)) return;

    // 关闭
    if (this.activeTool.value === MAP_TOOL.SPLIT) {
      this._clearInteractions();
      this.activeTool.value = null;
      return;
    }
    if (this.selectedFeature.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.SPLIT;
    const geoPolygon = new GeoJSON().writeFeatureObject(
      this.selectedFeature[0]
    );

    // 开启划线
    const draw = new Draw({
      source: this.renderLayerSource,
      type: "LineString"
    });
    draw.on("drawend", (evt) => {
      try {
        const geoLineString = new GeoJSON().writeFeatureObject(evt.feature);
        // 拆分
        const splitFeatureCollection = this._polygonCut(
          geoPolygon,
          geoLineString
        );

        this.renderLayer.getSource().addFeatures(
          new GeoJSON().readFeatures(splitFeatureCollection)
        );

        // 删除原始图形和分割线
        this.renderLayerSource.removeFeature(this.selectedFeature.shift());
        this._clearDrawEffect(evt.feature);
      } catch (error) {
        console.log(error);
        return message.error("出现未知错误");
      }
    });
    this.map.addInteraction(draw);
    this.interactionList.push(draw);
  }

  // 合并
  merge() {
    if (!this._checkActiveTool(MAP_TOOL.MERGE)) return;

    // 关闭
    if (this.activeTool.value === MAP_TOOL.MERGE) {
      this._clearInteractions();
      this.activeTool.value = null;
      return;
    }
    if (this.selectedFeature.length < 2) {
      message.error("请至少选择两个图形！");
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.MERGE;
    // 利用buff处理数据，规避合并精度问题
    const mergeFeatures = this.selectedFeature.map((item) =>
      turf.buffer(
        new GeoJSON().writeFeatureObject(item),
        0.0001,
        { units: "kilometers" }
      )
    );
    const mergedFeature = new GeoJSON().readFeature(
      turf.simplify(
        turf.union(...mergeFeatures),
        {
          tolerance: 0.000001,
          highQuality: false
        }
      )
    );
    this.renderLayerSource.addFeature(mergedFeature);
    // 删除原图形
    this.selectedFeature.forEach((item) => {
      this.renderLayerSource.removeFeature(item);
    });
    this.selectedFeature = [mergedFeature];

    // 关闭合并
    this.merge();
  }

  // 挖洞
  mask() {
    if (!this._checkActiveTool(MAP_TOOL.MASK)) return;
  
    // 关闭
    if (this.activeTool.value === MAP_TOOL.MASK) {
      this._clearInteractions();
      this.activeTool.value = null;
      return;
    }
    if (this.selectedFeature.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.MASK;
    const draw = new Draw({
      source: this.renderLayerSource,
      type: "Polygon"
    });
    this.map.addInteraction(draw);
    this.interactionList.push(draw);

    const maskFeature = this.selectedFeature[0];
    draw.on("drawend", evt => {
      let stashHole = null;
      const holePolygon = new GeoJSON().writeFeatureObject(evt.feature);
      const maskPolygon = new GeoJSON().writeFeatureObject(maskFeature);
      // 已经有空洞的情况下
      if (maskPolygon.geometry.coordinates.length > 1) {
        // 外围图形
        const temporary = maskPolygon.geometry.coordinates.shift();
        // 空洞图形
        stashHole = [...maskPolygon.geometry.coordinates]
        maskPolygon.geometry.coordinates = [temporary];
      }
      // TODO 当多个空洞存在重叠时，要不要处理 DFS可以处理

      if (maskPolygon.geometry.type === "MultiPolygon") {
        if (stashHole) {
          // 已经有空洞的情况下
          maskPolygon.geometry.coordinates[0].push(...stashHole);
        }
        maskPolygon.geometry.coordinates[0].push(
          holePolygon.geometry.coordinates[0].reverse()
        );
      } else {
        if (stashHole) {
          // 已经有空洞的情况下
          maskPolygon.geometry.coordinates.push(...stashHole);
        }
        maskPolygon.geometry.coordinates.push(
          holePolygon.geometry.coordinates[0].reverse()
        );
      }
      const result = new GeoJSON().readFeatures({
        ...maskPolygon,
        properties: maskPolygon.properties
      })[0];

      // 删除原图形
      this.renderLayerSource.removeFeature(maskFeature);
      this._clearDrawEffect(evt.feature);

      // 添加处理后图形
      this.renderLayerSource.addFeature(result);
      result.set("_status", "selected");
      this.selectedFeature = [result];
    });
  }

  // 打散
  breakUp() {
    if (!this._checkActiveTool(MAP_TOOL.BREAK_UP)) return;

    if (this.selectedFeature.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    const featureCollection = turf.unkinkPolygon(
      new GeoJSON().writeFeatureObject(this.selectedFeature[0])
    );
    console.log(featureCollection);
    
    if (featureCollection.features.length <2) {
      message.error("不需要打散");
      return;
    }
    // 开启功能
    this.renderLayerSource.removeFeature(this.selectedFeature[0]);
    const features = new GeoJSON().readFeatures(featureCollection);
    this.renderLayerSource.addFeatures(features);
    this.selectedFeature = [...features];
  }

  // 图斑整形
  plastic() {
    if (!this._checkActiveTool(MAP_TOOL.PLASTIC)) return;

    // 关闭
    if (this.activeTool.value === MAP_TOOL.PLASTIC) {
      this._clearInteractions();
      this.activeTool.value = null;
      return;
    }

    if (this.selectedFeature.length !== 1) {
      message.error("仅允许一个图形！");
      return;
    }
    // 开启功能
    this.activeTool.value = MAP_TOOL.PLASTIC;
    const draw = new Draw({
      source: this.renderLayerSource,
      type: "LineString"
    });
    this.map.addInteraction(draw);
    this.interactionList.push(draw);

    draw.on("drawend", evt => {
      try {
        const geoLineString = new GeoJSON().writeFeatureObject(evt.feature);
        const coordinates = geoLineString.geometry.coordinates;
        const startPonit = coordinates[0];
        const endPonit = coordinates[coordinates.length - 1];
        const currentPolygon = JSON.parse(
          new GeoJSON().writeFeature(this.selectedFeature[0])
        );
        const startInPolygon = turf.booleanPointInPolygon(startPonit, currentPolygon);
        const endInPolygon = turf.booleanPointInPolygon(endPonit, currentPolygon);
        if (startInPolygon && endInPolygon) { // 起点终点均在图形里 共边加合并
          coordinates.push(startPonit); // 共边画面图形
          const commonLinePolygon = turf.lineToPolygon(turf.lineString(coordinates));
          const newUnionPolygon = new GeoJSON().readFeature(turf.union(currentPolygon, commonLinePolygon));
          // 添加新图形
          this.renderLayer.getSource().addFeature(newUnionPolygon);
          // 删除原始图形
          this.renderLayer.getSource().removeFeature(this.selectedFeature[0]);

          // 绘制结束前后draw图形是不相等的
          this.selectedFeature = [newUnionPolygon];
          this._clearDrawEffect(evt.feature);
          this.plastic();
        } else if ((!startInPolygon) && (!endInPolygon)) { // 起点终点均不在在图形里 切割加删除
          this._plasticSplit(evt.feature, [this.selectedFeature[0]]);
        } else {
          this.plastic();
          this._clearDrawEffect(evt.feature);
          message.error("请确认起点、终点位置");
        }
      } catch (error) {
        console.log(error);
        
        this._clearDrawEffect(evt.feature);
        message.error("请规范操作");
      }
    });
  }

  // 删除
  remove() {
    if (this.selectedFeature.length === 0) {
      message.error("请选择要删除的图形！");
      return;
    }
    this.selectedFeature.forEach((feature) => {
      this.renderLayerSource.removeFeature(feature);
    });
    this.selectedFeature = [];
  }
    

  _plasticSplit(lineString, removeFeaGeoArr) {
    let todoPolygon = new GeoJSON().writeFeatureObject(this.selectedFeature[0]);
    if (todoPolygon.geometry.type === "MultiPolygon" && todoPolygon.geometry.coordinates[0].length > 1) { // 转为普通面
      if (todoPolygon.geometry.coordinates.length > 1) {
        return message.error("不支持多面");
      }
      todoPolygon.geometry.coordinates = todoPolygon.geometry.coordinates[0];
    }
    // 拆分
    const geoLineString = new GeoJSON().writeFeatureObject(lineString);
    const splitFeatureList = this._polygonCut(todoPolygon, geoLineString).features;
    if (splitFeatureList.length > 2) {
      this._clearDrawEffect(lineString);
      return message.error("只允许简单切割");
    }
    const attr = todoPolygon.properties;
    if (turf.area(splitFeatureList[0]) > turf.area(splitFeatureList[1])) {
      todoPolygon = splitFeatureList[0];
    } else {
      todoPolygon = splitFeatureList[1];
    }
    todoPolygon.properties = attr;
    // 添加新图形
    const newPolygon = new GeoJSON().readFeature(todoPolygon);
    this.renderLayer.getSource().addFeature(newPolygon);
    // 删除原始图形
    this.renderLayer.getSource().removeFeature(this.selectedFeature[0]);

    this.selectedFeature = [newPolygon];
    this._clearDrawEffect(lineString);
  }

  // 同步编辑图层
  _syncEditLayer() {
    this.editLayerSource.clear();
    const result = turf.explode(
      new GeoJSON().writeFeatureObject(this.selectedFeature[0])
    );
    this.editLayerSource.addFeatures(new GeoJSON().readFeatures(result));
  }

  _clearDrawEffect(feature) {
    this.renderLayer.once("postrender", () => {
      this.renderLayerSource.removeFeature(feature);
    });
  }

  // 检查是否有活跃工具冲突，返回布尔值
  _checkActiveTool(selfTool) {
    if (this.activeTool.value && this.activeTool.value !== selfTool) {
      message.warning(`请先关闭其他功能(${this.activeTool.value.description})`);
      return false;
    }
    return true;
  }
  /**
   * 使用线段切割多边形
   * 通过创建偏移线形成"粗线"区域，然后用该区域切割多边形，得到被切割后的多个多边形片段
   *
   * @param {Object} polygon - 待切割的多边形（GeoJSON格式，支持Polygon或MultiPolygon）
   * @param {Object} line - 切割线（GeoJSON格式，LineString类型）
   * @param {String} idPrefix - 生成的多边形ID前缀，默认为空字符串
   * @returns {Object|null} 返回切割后的多边形集合（FeatureCollection），如果切割失败则返回null
   */
  _polygonCut(polygon, line) {
    // 粗线的单位（千米）
    const THICK_LINE_UNITS = "kilometers";
    // 粗线的宽度（千米），用于创建偏移线
    const THICK_LINE_WIDTH = 0.001;

    // 验证输入参数：多边形必须是Polygon或MultiPolygon，线必须是LineString
    if (
      (polygon.geometry.type !== "Polygon" &&
        polygon.geometry.type !== "MultiPolygon") ||
      line.geometry.type !== "LineString"
    ) {
      return null;
    }

    // 检查多边形和线是否有交点，没有交点则无法切割
    const intersectPoints = turf.lineIntersect(polygon, line);
    if (intersectPoints.features.length === 0) {
      return null;
    }

    // 获取线的坐标点
    const lineCoords = turf.getCoords(line);
    // 检查线的起点或终点是否在多边形内部，如果是则无法切割
    if (
      turf.booleanPointInPolygon(turf.point(lineCoords[0]), polygon) ||
      turf.booleanPointInPolygon(
        turf.point(lineCoords[lineCoords.length - 1]),
        polygon
      )
    ) {
      return null;
    }

    // 创建两条偏移线（一条正向偏移，一条负向偏移），用于形成"粗线"区域
    const offsetLine = [];
    offsetLine[0] = turf.lineOffset(line, THICK_LINE_WIDTH, {
      units: THICK_LINE_UNITS,
    });
    offsetLine[1] = turf.lineOffset(line, -THICK_LINE_WIDTH, {
      units: THICK_LINE_UNITS,
    });

    // 存储切割后的多边形特征
    const cutFeatures = [];

    // 遍历两条偏移线，分别处理正向和负向偏移的情况
    for (let i = 0; i <= 1; i++) {
      const forCut = i; // 用于切割的偏移线索引
      const forSelect = (i + 1) % 2; // 用于选择的偏移线索引（另一条）

      // 构建粗线多边形的坐标：原线坐标 + 偏移线坐标（反向） + 原线起点
      let polyCoords = [];
      // 添加原线的所有坐标点
      for (let j = 0; j < line.geometry.coordinates.length; j++) {
        polyCoords.push(line.geometry.coordinates[j]);
      }
      // 反向添加偏移线的坐标点
      for (
        let j = offsetLine[forCut].geometry.coordinates.length - 1;
        j >= 0;
        j--
      ) {
        polyCoords.push(offsetLine[forCut].geometry.coordinates[j]);
      }
      // 闭合多边形，添加原线起点
      polyCoords.push(line.geometry.coordinates[0]);

      // 将坐标点转换为线，再转换为多边形（粗线区域）
      const thickLineString = turf.lineString(polyCoords);
      const thickLinePolygon = turf.lineToPolygon(thickLineString);
      // 用粗线区域从原多边形中"挖掉"这部分，得到切割后的多边形
      const clipped = turf.difference(polygon, thickLinePolygon);

      // 收集与另一条偏移线有交点的多边形片段（这些是需要保留的部分）
      const cutPolyGeoms = [];
      for (let j = 0; j < clipped.geometry.coordinates.length; j++) {
        const polyg = turf.polygon(clipped.geometry.coordinates[j]);
        const intersect = turf.lineIntersect(polyg, offsetLine[forSelect]);
        // 如果多边形片段与偏移线有交点，说明是需要保留的部分
        if (intersect.features.length > 0) {
          cutPolyGeoms.push(polyg.geometry.coordinates);
        }
      }

      // 为每个切割后的多边形片段生成ID并添加到结果中
      cutPolyGeoms.forEach((geometry) => {
        cutFeatures.push(turf.polygon(geometry));
      });
    }

    // 如果有切割结果，返回FeatureCollection，否则返回null
    return cutFeatures.length > 0 ? turf.featureCollection(cutFeatures) : null;
  }

  // 清除地图里的交互
  _clearInteractions() {
    this.interactionList.forEach((interaction) => {
      this.map.removeInteraction(interaction);
    });
    this.interactionList = [];
  }

  _createRenderLayer() {
    const renderLayer = createVectorLayer({
      id: RENDER_LAYER,
      source: new VectorSource(),
      style: renderLayerStyle,
    });
    return renderLayer;
  }
  _createEditLayer() {
    const editLayer = createVectorLayer({
      id: EDIT_LAYER,
      source: new VectorSource(),
      zIndex: 10,
      style: editLayerStyle,
    });
    return editLayer;
  }
  
  // 处理重叠图斑
  _handleOverlappingFeatures(features) {
    // 保存当前重叠的图斑
    this.overlappingFeatures = features;
    
    // 如果有弹窗回调函数，显示弹窗
    if (this.showFeatureDialog) {
      const callbacks = {};
      this.showFeatureDialog(features, callbacks);
      // 注意：这里不等待Promise，因为弹窗的确认/取消会通过回调函数处理
    } else {
      // 如果没有弹窗功能，默认选择第一个
      console.warn("未提供弹窗回调函数，默认选择第一个图斑");
      this._selectFeature(features[0]);
    }
  }

  // 处理用户选择图斑（从弹窗确认）
  _handleFeatureSelect(feature) {
    this._selectFeature(feature);
    // 清空重叠图斑列表
    this.overlappingFeatures = [];
  }

  // 处理用户取消选择（从弹窗取消）
  _handleFeatureCancel() {
    // 清空重叠图斑列表，不选择任何图斑
    this.overlappingFeatures = [];
  }

  // 选中图斑的通用方法
  _selectFeature(feature) {
    // 如果已经选中，则取消选中
    if (this.selectedFeature.includes(feature)) {
      feature.set("_status", "normal");
      this.selectedFeature.splice(
        this.selectedFeature.indexOf(feature),
        1
      );
    } else {
      // 添加选中
      feature.set("_status", "selected");
      this.selectedFeature.unshift(feature);
    }
  }
  // 需要开启图斑选择功能
  _addSelectInteraction() {
    this.map.on("click", (e) => {
      if (this.activeTool.value) {
        // 处在操作中 不进行选择
        return;
      }
      // getFeaturesAtPixel
      const features = this.map.getFeaturesAtPixel(e.pixel, {
        layerFilter: (layer) => {
          return layer === this.renderLayer;
        },
      });

      // 处理重复图斑
      if (features.length > 1) {
        // 重叠图斑 需要选择
        this._handleOverlappingFeatures(features);
      } else {
        const feature = features[0];
        // 点击空白移出所有
        if (!feature) {
          this.selectedFeature.forEach((feature) => {
            feature.set("_status", "normal");
          });
          this.selectedFeature = [];
        } else {
          // 已经选中 则取消选中
          if (this.selectedFeature.includes(feature)) {
            // 删除
            feature.set("_status", "normal");
            this.selectedFeature.splice(
              this.selectedFeature.indexOf(feature),
              1
            );
          } else {
            // 添加
            feature.set("_status", "selected");
            // NOTICE 为什么从前边开始加？忘了，以后看
            this.selectedFeature.unshift(feature);
          }
        }
      }
    });
  }
}

export default GeometryEdit;
