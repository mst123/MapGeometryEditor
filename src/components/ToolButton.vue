<template>
  <button
    :class="['tool-button', { active: isActive, disabled: disabled }]"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
interface Props {
  isActive?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  disabled: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
.tool-button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  color: #333;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.tool-button:hover:not(.disabled) {
  background-color: #f5f5f5;
  border-color: #999;
}

.tool-button.active {
  background-color: #1890ff;
  color: #fff;
  border-color: #1890ff;
}

.tool-button.active:hover {
  background-color: #40a9ff;
  border-color: #40a9ff;
}

.tool-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f5f5f5;
}
</style>

