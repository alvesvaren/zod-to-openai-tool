type RecursiveOmit<T, K extends string | number | symbol> = {
  [P in keyof T]: P extends K
    ? never
    : T[P] extends infer TP
      ? TP extends object
        ? RecursiveOmit<TP, K>
        : TP
      : never;
};

/** @internal */
export function deepRemoveKey<T, K extends string>(obj: T, key: K) {
  const { [key]: _, ...rest } = obj;
  type Keys = keyof typeof rest;
  Object.keys(rest).forEach((_k: string) => {
    const k = _k as Keys;
    if (typeof rest[k] === "object" && !Array.isArray(rest[k])) {
      rest[k] = deepRemoveKey(rest[k], key) as (typeof rest)[Keys];
    }
  });

  return rest as RecursiveOmit<T, K>;
}
