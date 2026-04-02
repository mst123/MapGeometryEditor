<template>
  <div class="map-wrap">
    <div class="toolbar">
      <button :class="{ active: toolActive === 'ADD_NEW' }" @click="() => editor?.startAddNew()">
        新增
      </button>
      <button
        :class="{ active: toolActive === 'COMMON_LINE_ADD' }"
        @click="() => editor?.startCommonLineAdd()"
      >
        共边画面
      </button>
      <button :class="{ active: toolActive === 'EDIT_NODES' }" @click="() => editor?.startEditNodes()">
        编辑节点
      </button>
      <button
        :class="{ active: toolActive === 'FEATURE_TRANSFER' }"
        @click="() => editor?.startFeatureTransfer()"
      >
        重画
      </button>
      <button :class="{ active: toolActive === 'SPLIT' }" @click="() => editor?.startSplit()">
        拆分
      </button>
      <button :class="{ active: toolActive === 'MERGE' }" @click="() => editor?.startMerge()">
        合并
      </button>
      <button :class="{ active: toolActive === 'MASK' }" @click="() => editor?.startMask()">
        挖洞
      </button>
      <button :class="{ active: toolActive === 'BREAK_UP' }" @click="() => editor?.startBreakUp()">
        打散
      </button>
      <button :class="{ active: toolActive === 'PLASTIC' }" @click="() => editor?.startPlastic()">
        图斑整形
      </button>
      <button @click="() => editor?.deleteSelection()">删除</button>

      <div class="sep" />
      <button :disabled="!canUndo" @click="() => editor?.undo()">后退</button>
      <button :disabled="!canRedo" @click="() => editor?.redo()">前进</button>
    </div>

    <div ref="mapEl" class="map-root" />
    <div class="hint">
      选中：{{ selectedIds.length }} 个图斑。<span class="muted">新图斑会写入 `id` 和 `__parentFids`。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, ref } from "vue";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style } from "ol/style";
import GeoJSON from "ol/format/GeoJSON";

import { FeatureStore } from "../editor/FeatureStore";
import { HistoryController } from "../editor/History";
import { EditorCore } from "../editor/EditorCore";

const mapEl = ref<HTMLDivElement | null>(null);

const editor = shallowRef<EditorCore | null>(null);
const history = shallowRef<HistoryController | null>(null);

const selectedIds = computed(() => editor.value?.getSelectedIds() ?? []);
const canUndo = computed(() => history.value?.canUndo() ?? false);
const canRedo = computed(() => history.value?.canRedo() ?? false);

// 仅用于 UI 高亮；EditorCore 内部的 activeTool 当前未对外暴露
const toolActive = ref<string | null>(null);

onMounted(() => {
  if (!mapEl.value) return;

  const baseSource = new VectorSource();
  const draftSource = new VectorSource();

  const normalStyle = new Style({
    fill: new Fill({ color: "rgba(80, 160, 255, 0.25)" }),
    stroke: new Stroke({ color: "rgba(40, 90, 180, 0.9)", width: 2 }),
  });
  const selectedStyle = new Style({
    fill: new Fill({ color: "rgba(255, 210, 0, 0.28)" }),
    stroke: new Stroke({ color: "rgba(255, 210, 0, 0.95)", width: 3 }),
  });

  const baseLayer = new VectorLayer({
    source: baseSource,
    style: (feature) => (feature.get("_selected") ? selectedStyle : normalStyle),
  });

  const draftLayer = new VectorLayer({
    source: draftSource,
    style: new Style({
      fill: new Fill({ color: "rgba(120, 120, 120, 0.12)" }),
      stroke: new Stroke({ color: "rgba(200, 200, 200, 0.9)", width: 2, lineDash: [6, 6] }),
    }),
  });

  const map = new Map({
    target: mapEl.value,
    layers: [
      new TileLayer({ source: new OSM() }),
      baseLayer,
      draftLayer,
    ],
    view: new View({
      center: [104, 35],
      zoom: 4,
      projection: "EPSG:4326",
    }),
  });

  const geojson = new GeoJSON();
  const store = new FeatureStore({ source: baseSource, geojson });
  const h = new HistoryController();
  history.value = h;
  editor.value = new EditorCore({
    map,
    store,
    draftSource,
    history: h,
  });

  // 可选：给交互工具准备一个提示层（暂不使用额外交互）
});
</script>

<style scoped>
.map-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-root {
  width: 100%;
  height: calc(100vh - 90px);
}
.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: rgba(0, 0, 0, 0.35);
  padding: 10px;
  border-radius: 8px;
}
.toolbar button {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
.toolbar button.active {
  background: rgba(255, 210, 0, 0.22);
  border-color: rgba(255, 210, 0, 0.6);
}
.toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sep {
  width: 1px;
  background: rgba(255, 255, 255, 0.25);
  margin: 0 4px;
}
.hint {
  position: absolute;
  right: 12px;
  top: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  color: #fff;
  z-index: 10;
  font-size: 12px;
}
.muted {
  color: rgba(255, 255, 255, 0.7);
}
</style>

