/**
 * 找出所有有关系的元素组（连通分量）
 * @param {Array} elements - 元素数组
 * @param {Function} isRelate - 判断函数 (a, b) => boolean
 * @returns {Array<Array>} - 返回多个数组
 */
function findRelatedGroups(elements, isRelate) {
  const visited = new Set();
  const groups = [];
  
  function dfs(element, currentGroup) {
    visited.add(element);
    currentGroup.push(element);
    
    // 遍历所有未访问的元素，找出与当前元素有关系的
    for (const other of elements) {
      if (!visited.has(other) && isRelate(element, other)) {
        dfs(other, currentGroup);
      }
    }
  }
  
  // 遍历所有元素
  for (const element of elements) {
    if (!visited.has(element)) {
      const group = [];
      dfs(element, group);
      groups.push(group);
    }
  }
  
  return groups;
}