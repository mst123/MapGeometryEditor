import * as turf from "@turf/turf";

/**
 * 纯几何：用“粗线区域”从 polygon 中挖掉这部分，得到切割后的碎片。
 * 返回值：FeatureCollection（或 null）
 *
 * 输入/输出均使用 turf 的 GeoJSON 风格对象（Feature / FeatureCollection）。
 */
export function polygonCut(polygon: any, line: any) {
  const THICK_LINE_UNITS = "kilometers";
  const THICK_LINE_WIDTH = 0.001;

  if (
    (polygon.geometry.type !== "Polygon" &&
      polygon.geometry.type !== "MultiPolygon") ||
    line.geometry.type !== "LineString"
  ) {
    return null;
  }

  const intersectPoints = turf.lineIntersect(polygon, line);
  if (intersectPoints.features.length === 0) {
    return null;
  }

  const lineCoords = turf.getCoords(line);
  if (
    turf.booleanPointInPolygon(turf.point(lineCoords[0]), polygon) ||
    turf.booleanPointInPolygon(
      turf.point(lineCoords[lineCoords.length - 1]),
      polygon
    )
  ) {
    return null;
  }

  const offsetLine: any[] = [];
  offsetLine[0] = turf.lineOffset(line, THICK_LINE_WIDTH, {
    units: THICK_LINE_UNITS,
  });
  offsetLine[1] = turf.lineOffset(line, -THICK_LINE_WIDTH, {
    units: THICK_LINE_UNITS,
  });

  const cutFeatures: any[] = [];

  for (let i = 0; i <= 1; i++) {
    const forCut = i;
    const forSelect = (i + 1) % 2;

    const polyCoords: any[] = [];

    for (let j = 0; j < line.geometry.coordinates.length; j++) {
      polyCoords.push(line.geometry.coordinates[j]);
    }

    for (
      let j = offsetLine[forCut].geometry.coordinates.length - 1;
      j >= 0;
      j--
    ) {
      polyCoords.push(offsetLine[forCut].geometry.coordinates[j]);
    }

    polyCoords.push(line.geometry.coordinates[0]);

    const thickLineString = turf.lineString(polyCoords);
    const thickLinePolygon = turf.lineToPolygon(thickLineString);

    const clipped = turf.difference(polygon, thickLinePolygon);
    const cutPolyGeoms: any[] = [];

    if (!clipped || !clipped.geometry || !clipped.geometry.coordinates) {
      continue;
    }

    const coords = clipped.geometry.coordinates;
    // Polygon 的 clipped.geometry.coordinates 结构可能不统一，这里按老逻辑尽量兼容
    for (let j = 0; j < coords.length; j++) {
      // coords[j] 期望是一个 polygon ring set
      const polyg = turf.polygon(coords[j]);
      const intersect = turf.lineIntersect(polyg, offsetLine[forSelect]);
      if (intersect.features.length > 0) {
        cutPolyGeoms.push(polyg.geometry.coordinates);
      }
    }

    cutPolyGeoms.forEach((geometry) => {
      cutFeatures.push(turf.polygon(geometry));
    });
  }

  return cutFeatures.length > 0 ? turf.featureCollection(cutFeatures) : null;
}

export function mergePolygons(features: any[]) {
  const mergeFeatures = features.map((f) =>
    turf.buffer(f, 0.0001, { units: "kilometers" })
  );

  const merged = turf.union(...mergeFeatures);
  // 避免合并精度导致 polygon 太碎
  const simplified = turf.simplify(merged, {
    tolerance: 0.000001,
    highQuality: false,
  });
  return simplified;
}

export function maskPolygon(maskPolygon: any, holePolygon: any) {
  // 复制输入对象，避免外部引用被污染
  const out = JSON.parse(JSON.stringify(maskPolygon));
  const hole = JSON.parse(JSON.stringify(holePolygon));

  let stashHole: any[] | null = null;

  if (out.geometry.coordinates.length > 1) {
    // “已有空洞/多面”的旧逻辑兼容：shift 外环，剩下作为 stashHole
    const temporary = out.geometry.coordinates.shift();
    stashHole = [...out.geometry.coordinates];
    out.geometry.coordinates = [temporary];
  }

  if (out.geometry.type === "MultiPolygon") {
    if (stashHole) {
      out.geometry.coordinates[0].push(...stashHole);
    }
    out.geometry.coordinates[0].push(hole.geometry.coordinates[0].reverse());
  } else {
    if (stashHole) {
      out.geometry.coordinates.push(...stashHole);
    }
    out.geometry.coordinates.push(hole.geometry.coordinates[0].reverse());
  }

  return {
    ...out,
    properties: out.properties ?? maskPolygon.properties,
  };
}

export function commonLineAdd(selectedPolygons: any[], drawPolygon: any) {
  const filterPart: any[] = [];

  selectedPolygons.forEach((item) => {
    if (item.geometry.type === "Polygon" || item.geometry.type === "MultiPolygon") {
      const different = turf.difference(item, drawPolygon);
      if (!turf.booleanEqual(different, item)) {
        filterPart.push(turf.buffer(item, 0.0001, { units: "kilometers" }));
      }
    }
  });

  if (!filterPart.length) return null;

  const unioned = turf.union(...filterPart);
  const handled = turf.difference(drawPolygon, unioned);
  // old 逻辑取 [0]；这里统一返回 handled（Feature 或 Geometry）
  return handled;
}

