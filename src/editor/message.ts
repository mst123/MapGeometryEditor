export const message = {
  error(msg: string) {
    // 简化：先保证可运行，UI 层可后续再接入
    console.error(msg);
  },
  warning(msg: string) {
    console.warn(msg);
  },
  info(msg: string) {
    console.info(msg);
  },
};

