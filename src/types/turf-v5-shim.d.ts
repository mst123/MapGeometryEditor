// 最小 Turf v5 类型声明，避免在不升级情况下的 TS 报错
// 仅声明当前项目中用到的 API；如有新增，再补充即可

declare module '@turf/turf' {
  // 基础类型占位
  export type Feature = any
  export type FeatureCollection = any
  export type Polygon = any
  export type MultiPolygon = any
  export type LineString = any

  // 几何计算 API（项目中已用）
  export function union(...features: any[]): any
  export function difference(a: any, b: any): any
  export function intersect(a: any, b: any): any
  export function unkinkPolygon(polygon: any): any
  export function simplify(feature: any, options?: any): any
  export function buffer(feature: any, distance: number, options?: any): any
  export function booleanPointInPolygon(point: any, polygon: any): boolean
  export function booleanEqual(a: any, b: any): boolean
  export function kinks(polygon: any): any
  export function area(polygon: any): number
  export function point(coords: any, options?: any): any

  // 线/面转换与偏移
  export function lineOffset(line: any, distance: number, options?: any): any
  export function lineToPolygon(line: any): any
  export function lineString(coords: any[], properties?: any): any

  // 线/面相交	on
  export function lineIntersect(a: any, b: any): any

  // bbox、范围相关
  export function bboxPolygon(bbox: any): any
  export function bbox(feature: any): any

  // 工具
  export function getCoords(feature: any): any

  // feature/collection 构造
  export function polygon(coordinates: any, properties?: any): any
  export function featureCollection(features: any[]): any
}
