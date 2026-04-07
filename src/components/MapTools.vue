<template>
  <div class="map-tools">
    <ToolButton :isActive="activeTool === MAP_TOOL.ADD_NEW" @click="tools?.addNew()">新增</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.COMMON_LINE_ADD_NEW" @click="tools?.commonLineAdd()">共边画面
    </ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.EDIT" @click="tools?.edit()">编辑节点</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.FEATURE_TRANSFER" @click="tools?.featureTransfer()">重画</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.SPLIT" @click="tools?.split()">拆分</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.MERGE" @click="tools?.merge()">合并</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.MASK" @click="tools?.mask()">挖洞</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.BREAK_UP" @click="tools?.breakUp()">打散</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.PLASTIC" @click="tools?.plastic()">图斑整形</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.DELETE" @click="tools?.remove()">删除</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.BACK" @click="tools?.back()">后退</ToolButton>
    <ToolButton :isActive="activeTool === MAP_TOOL.FORWARD" @click="tools?.forward()">前进</ToolButton>
    <!-- <ToolButton :isActive="activeTool === MAP_TOOL.SAVE" @click="tools?.save()">保存</ToolButton> -->
  </div>
  <!-- 图斑选择弹窗 -->
  <FeatureSelectDialog :visible="dialogVisible" :features="dialogFeatures" @confirm="handleDialogConfirm"
    @cancel="handleDialogCancel" @hover="handleDialogHover" />
</template>

<script setup>
import ToolButton from './ToolButton.vue'
import FeatureSelectDialog from './FeatureSelectDialog.vue'
import GeometryEdit from '../utils/Geometry-Edit'
import { onMounted, shallowRef, ref } from 'vue'
import { MAP_TOOL } from '../const'
import features from '../../public/features.js'
import GeoJSON from 'ol/format/GeoJSON'

const tools = shallowRef(null)
const activeTool = ref(null)

// 弹窗相关状态
const dialogVisible = ref(false)
const dialogFeatures = ref([])
const dialogHoverIndex = ref(-1)
// 记录图斑的原始状态（用于恢复）
const featureOriginalStatus = new Map()

const props = defineProps({ map: Map })

onMounted(() => {
  // 创建显示弹窗的回调函数
  const showFeatureDialog = (features, callbacks) => {
    dialogFeatures.value = features
    dialogVisible.value = true
    dialogHoverIndex.value = -1

    // 记录每个图斑的原始状态
    featureOriginalStatus.clear()
    features.forEach((feature, index) => {
      const originalStatus = feature.get('_status') || 'normal'
      featureOriginalStatus.set(feature, originalStatus)
    })

    // 返回一个Promise，用于等待用户选择
    return new Promise((resolve, reject) => {
      // 将resolve和reject保存到回调对象中
      callbacks.resolve = resolve
      callbacks.reject = reject
    })
  }

  tools.value = new GeometryEdit(props.map, {
    activeToolRef: activeTool,
    showFeatureDialog: showFeatureDialog
  })

  // 添加图斑
  tools.value.renderLayerSource.addFeatures(
    new GeoJSON().readFeatures(features)

  )
})

// 弹窗确认
const handleDialogConfirm = (feature, index) => {
  dialogVisible.value = false
  // 恢复所有图斑的原始状态
  dialogFeatures.value.forEach(f => {
    const originalStatus = featureOriginalStatus.get(f) || 'normal'
    f.set('_status', originalStatus)
  })
  dialogFeatures.value = []
  dialogHoverIndex.value = -1
  featureOriginalStatus.clear()

  // 通知 GeometryEdit 用户选择了哪个图斑
  if (tools.value && tools.value._handleFeatureSelect) {
    tools.value._handleFeatureSelect(feature)
  }
}

// 弹窗取消
const handleDialogCancel = () => {
  dialogVisible.value = false
  // 恢复所有图斑的原始状态
  dialogFeatures.value.forEach(f => {
    const originalStatus = featureOriginalStatus.get(f) || 'normal'
    f.set('_status', originalStatus)
  })
  dialogFeatures.value = []
  dialogHoverIndex.value = -1
  featureOriginalStatus.clear()

  // 通知 GeometryEdit 用户取消了选择
  if (tools.value && tools.value._handleFeatureCancel) {
    tools.value._handleFeatureCancel()
  }
}

// 弹窗悬停
const handleDialogHover = (index) => {
  // 清除之前的高亮，恢复原始状态
  if (dialogHoverIndex.value >= 0 && dialogHoverIndex.value < dialogFeatures.value.length) {
    const prevFeature = dialogFeatures.value[dialogHoverIndex.value]
    if (prevFeature.get('_status') === 'hover') {
      // 恢复原始状态
      const originalStatus = featureOriginalStatus.get(prevFeature) || 'normal'
      prevFeature.set('_status', originalStatus)
    }
  }

  // 设置新的高亮（hover 优先级最高）
  if (index >= 0 && index < dialogFeatures.value.length) {
    const feature = dialogFeatures.value[index]
    feature.set('_status', 'hover')
    dialogHoverIndex.value = index
    // 触发图层重绘
    if (tools.value && tools.value.renderLayer) {
      tools.value.renderLayer.changed()
    }
  }
}

</script>

<style scoped>
.map-tools {
  display: flex;
  gap: 8px;
  padding: 8px;
}
</style>
