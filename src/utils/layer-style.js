import { Circle as CircleStyle, Fill, Stroke, Style, Icon } from "ol/style";

export function renderLayerStyle(feature) { 
  const { _status = 'normal' } = feature.getProperties()
  const type = feature.getGeometry().getType()
  // 根据状态设置样式，hover 优先级高于 selected
  let strokeColor = '#0000ff'
  let strokeWidth = 1
  
  if (_status === 'hover') {
    // 高亮状态：使用橙色，优先级最高
    strokeColor = '#ff8800'
    strokeWidth = 1.5
  } else if (_status === 'selected') {
    // 选中状态：使用黄色
    strokeColor = '#ffff00'
    strokeWidth = 2
  }
  
  if (type === 'Polygon' || type === 'MultiPolygon') {
    return [
      new Style({
        stroke: new Stroke({
          color: strokeColor,
          width: strokeWidth
        }),
        // 没有填充色 点内部无法选中 尴尬
        fill: new Fill({
          color: [255, 0, 0, 0],
        })
      })
    ]
  }
  return [
    new Style({
      stroke: new Stroke({
        color: strokeColor,
        width: strokeWidth
      })
    })
  ]
}

export function editLayerStyle(feature) {
  return [new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({
        color: "#0099FF"
      }),
      stroke: new Stroke({ color: "#FFFFFF", width: 1 })
    })
  })]

}