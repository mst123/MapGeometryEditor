<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog-container">
        <div class="dialog-header">
          <h3>选择图斑</h3>
          <button class="close-btn" @click="handleCancel" title="关闭">×</button>
        </div>
        <div class="dialog-body">
          <p class="dialog-tip">检测到 {{ features.length }} 个重叠图斑，请选择其中一个：</p>
          <div class="feature-list">
            <label
              v-for="(feature, index) in features"
              :key="index"
              :class="['feature-item', { active: selectedIndex === index }]"
            >
              <input
                type="radio"
                :value="index"
                :name="'feature-radio'"
                :checked="selectedIndex === index"
                @change="handleSelect(index)"
              />
              <span class="feature-label">图斑 {{ index + 1 }}</span>
            </label>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click.stop="handleCancel">取消</button>
          <button class="btn btn-confirm" @click.stop="handleConfirm">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  features: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['confirm', 'cancel', 'hover'])

const selectedIndex = ref(0)

// 当弹窗显示时，默认选中第一个
watch(() => props.visible, (newVal) => {
  if (newVal && props.features.length > 0) {
    selectedIndex.value = 0
    // 默认高亮第一个
    emit('hover', 0)
  }
})

// 键盘事件处理
const handleKeyDown = (event) => {
  if (!props.visible) return
  
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      if (selectedIndex.value > 0) {
        selectedIndex.value--
        handleSelect(selectedIndex.value)
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (selectedIndex.value < props.features.length - 1) {
        selectedIndex.value++
        handleSelect(selectedIndex.value)
      }
      break
    case 'Enter':
      event.preventDefault()
      handleConfirm()
      break
    case 'Escape':
      event.preventDefault()
      handleCancel()
      break
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 选择某个图斑
const handleSelect = (index) => {
  console.log('handleSelect called with index:', index)
  if (index >= 0 && index < props.features.length) {
    selectedIndex.value = index
    emit('hover', index)
  }
}

// 确认选择
const handleConfirm = () => {
  if (selectedIndex.value >= 0 && selectedIndex.value < props.features.length) {
    emit('confirm', props.features[selectedIndex.value], selectedIndex.value)
  }
}

// 取消选择
const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 400px;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.dialog-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.dialog-tip {
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #fff;
}

.feature-item:hover {
  border-color: #1890ff;
  background-color: #f0f7ff;
}

.feature-item.active {
  border-color: #1890ff;
  background-color: #e6f7ff;
}

.feature-item input[type="radio"] {
  margin-right: 12px;
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.feature-label {
  font-size: 14px;
  color: #333;
  user-select: none;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 8px 20px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background-color: #fff;
  color: #333;
}

.btn-cancel:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-confirm {
  background-color: #1890ff;
  color: #fff;
  border-color: #1890ff;
}

.btn-confirm:hover {
  background-color: #40a9ff;
  border-color: #40a9ff;
}
</style>

