<template>
  <div class="map-tools">
    <ToolButton>新增</ToolButton>
    <ToolButton>共边画面</ToolButton>
    <ToolButton>编辑节点</ToolButton>
    <ToolButton>重画</ToolButton>
    <ToolButton>拆分</ToolButton>
    <ToolButton>合并</ToolButton>
    <ToolButton>挖洞</ToolButton>
    <ToolButton>打散</ToolButton>
    <ToolButton>图斑整形</ToolButton>
    <ToolButton>删除</ToolButton>
    <ToolButton>后退</ToolButton>
    <ToolButton>前进</ToolButton>
    <ToolButton>保存</ToolButton>
  </div>
</template>

<script setup lang="ts">
import ToolButton from './ToolButton.vue'
import type Map from 'ol/Map'

const props = defineProps<{ map: Map }>()

let tools: MapTools | null = null


</script>

<style scoped>
.map-tools {
  display: flex;
  gap: 8px;
  padding: 8px;
}
</style>

