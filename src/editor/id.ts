import type Feature from "ol/Feature";

function genFallbackFid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `fid_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
}

export function getFeatureAnyId(feature: Feature): string | null {
  return (
    feature.get("id") ??
    feature.get("ID") ??
    (typeof feature.getId === "function" ? (feature.getId() as any) : null) ??
    null
  );
}

/**
 * 保底：确保 feature 上一定有 `id` 属性（不是 getId，而是 get('id')）。
 */
export function ensureFeatureId(feature: Feature): string {
  let fid = getFeatureAnyId(feature);
  if (!fid) {
    fid = genFallbackFid();
  }
  if (feature.get("id") !== fid) {
    feature.set("id", fid);
  }
  return fid;
}

function removeInternalProps(props: Record<string, any>) {
  // 这些字段只用于 UI/内部状态，不参与“直接覆盖”的业务属性继承
  delete props.__parentFids;
  delete props.id;
  delete props.ID;
  delete props._status;
  delete props._toBeSave;
  delete props._changed;
  return props;
}

/**
 * 对“新生成的图斑”执行统一规则：
 * - 赋予新 `id`
 * - `__parentFids` 写入“直接父级”的 id 列表（去重后）
 * - 直接覆盖继承父图斑属性（不包括 id），并额外加 __parentFids
 */
export function assignDerivedFeatureMeta(
  parentFeatures: Feature[],
  derivedFeatures: Feature[]
) {
  const parents = parentFeatures.filter(Boolean);
  const parentFids = [
    ...new Set(parents.map((p) => ensureFeatureId(p)).filter(Boolean)),
  ];

  const basePropsRaw =
    parents[0] && typeof parents[0].getProperties === "function"
      ? { ...(parents[0].getProperties() as Record<string, any>) }
      : {};

  const baseProps = removeInternalProps(basePropsRaw);

  derivedFeatures.forEach((f) => {
    if (!f) return;
    // 直接覆盖：业务属性继承
    f.setProperties(baseProps);
    // 新图斑：新 id + 直接父级追溯
    f.set("id", genFallbackFid());
    f.set("__parentFids", parentFids);
  });
}

/**
 * 对“没有父级”的新建图斑：
 * - 赋予新 id
 * - __parentFids = []
 */
export function assignNewFeatureMeta(feature: Feature) {
  feature.set("id", genFallbackFid());
  feature.set("__parentFids", []);
}

